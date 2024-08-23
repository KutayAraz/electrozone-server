import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { DataSource, EntityManager, In, QueryFailedError, Repository } from "typeorm";
import { CartItemDto } from "./dtos/cart-item.dto";
import { FormattedCartProduct } from "./types/formatted-cart-product.type";
import { PriceChange } from "./types/price-change.type";
import { LocalCartResponse } from "./types/local-cart-response.type";
import CartResponse from "./types/cart-response.type";
import QuantityChange from "./types/quantity-change.type";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";

@Injectable()
export class CartsService {
  private readonly logger = new Logger(CartsService.name);

  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    private dataSource: DataSource,
  ) { }

  async getUserCart(userId: number, transactionalEntityManager?: EntityManager): Promise<CartResponse> {
    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async (transactionManager) => {

      let cart = await this.findOrCreateCart(userId, transactionManager);

      const { products, removedItems, priceChanges, quantityChanges } = await this.fetchAndUpdateCartProducts(cart.id, transactionManager);

      // Recalculate cart total and quantity
      const cartTotal = products.reduce((total, product) => total + product.amount, 0);
      const totalQuantity = products.reduce((total, product) => total + product.quantity, 0);

      // Update cart in database
      await transactionManager.update(Cart, cart.id, { cartTotal, totalQuantity });

      return {
        cartTotal,
        totalQuantity,
        products,
        removedItems,
        priceChanges,
        quantityChanges,
      };
    });
  }

  private async fetchAndUpdateCartProducts(cartId: number, transactionManager: EntityManager): Promise<{
    products: FormattedCartProduct[],
    removedItems: string[],
    priceChanges: PriceChange[],
    quantityChanges: QuantityChange[]
  }> {
    const cartItems = await this.getCartItemsWithProducts(cartId, transactionManager);
  
    const formattedProducts: FormattedCartProduct[] = [];
    const removedItems: string[] = [];
    const priceChanges: PriceChange[] = [];
    const quantityChanges: QuantityChange[] = [];
  
    await Promise.all(cartItems.map(async (item) => {
      if (item.product.stock > 0) {
        const { updatedItem, quantityChange, priceChange } = 
          await this.updateCartItem(item, transactionManager);
  
        formattedProducts.push(this.formatCartProduct(updatedItem));
        if (quantityChange) quantityChanges.push(quantityChange);
        if (priceChange) priceChanges.push(priceChange);
      } else {
        await transactionManager.delete(CartItem, item.id);
        removedItems.push(item.product.productName);
      }
    }));
  
    return { products: formattedProducts, removedItems, priceChanges, quantityChanges };
  }

  private async findOrCreateCart(userId: number, transactionManager: EntityManager): Promise<Cart> {
    const cart = await transactionManager.findOne(Cart, {
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (cart) return cart;

    const user = await transactionManager.findOne(User, { where: { id: userId } });
    if (!user) throw new AppError(ErrorType.USER_NOT_FOUND, userId, 'User');

    const newCart = transactionManager.create(Cart, {
      user,
      cartTotal: 0,
      totalQuantity: 0,
    });
    return await transactionManager.save(newCart);
  }

  private formatCartProduct(item: CartItem): FormattedCartProduct {
    return {
      cartItemId: item.id,
      quantity: item.quantity,
      amount: item.product.price * item.quantity,
      id: item.product.id,
      productName: item.product.productName,
      avgRating: item.product.averageRating,
      thumbnail: item.product.thumbnail,
      price: item.product.price,
      subcategory: item.product.subcategory.subcategory,
      category: item.product.subcategory.category.category,
    };
  }

  private async getCartItemsWithProducts(cartId: number, transactionManager: EntityManager) {
    return transactionManager
      .createQueryBuilder(CartItem, "cartItem")
      .select([
        "cartItem.id", "cartItem.quantity", "cartItem.amount", "cartItem.addedPrice",
        "product.productName", "product.averageRating", "product.thumbnail",
        "product.price", "product.id", "product.stock",
        "subcategory.subcategory", "category.category",
      ])
      .innerJoin("cartItem.product", "product")
      .innerJoin("product.subcategory", "subcategory")
      .innerJoin("subcategory.category", "category")
      .where("cartItem.cartId = :cartId", { cartId })
      .getMany();
  }

  private async updateCartItem(item: CartItem, transactionManager: EntityManager) {
    const currentPrice = item.product.price;
    const addedPrice = item.addedPrice;
    let quantity = item.quantity;
    let quantityChange: QuantityChange | null = null;
    let priceChange: PriceChange | null = null;

    if (quantity > item.product.stock || quantity > 10) {
      const oldQuantity = quantity;
      quantity = Math.min(item.product.stock, 10);
      quantityChange = {
        productName: item.product.productName,
        oldQuantity,
        newQuantity: quantity,
        reason: quantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
      };
      await transactionManager.update(CartItem, item.id, {
        quantity,
        amount: currentPrice * quantity
      });
    }

    if (addedPrice !== null && addedPrice !== undefined && currentPrice !== addedPrice) {
      priceChange = {
        productName: item.product.productName,
        oldPrice: addedPrice,
        newPrice: currentPrice,
      };
      await transactionManager.update(CartItem, item.id, {
        addedPrice: currentPrice,
        amount: currentPrice * quantity
      });
    }

    return { updatedItem: { ...item, quantity, addedPrice: currentPrice }, quantityChange, priceChange };
  }

  async getLocalCartInformation(products: CartItemDto[]): Promise<LocalCartResponse> {
    if (!Array.isArray(products)) {
      throw new AppError(ErrorType.INVALID_INPUT, undefined, "Expected an array of products");
    }

    const productIds = products.map(product => product.productId);
    const foundProducts = await this.productsRepo.find({
      where: { id: In(productIds) },
      select: ['id', 'productName', 'thumbnail', 'price', 'brand', 'stock'],
      relations: ["subcategory", "subcategory.category"],
    });

    const productMap = new Map(foundProducts.map(product => [product.id, product]));
    const localCartProducts = [];
    const removedItems: string[] = [];
    const quantityAdjustments: QuantityChange[] = [];
    let cartTotal = 0;
    let totalQuantity = 0;

    for (const product of products) {
      const foundProduct = productMap.get(product.productId);
      if (!foundProduct) continue;

      if (foundProduct.stock <= 0) {
        removedItems.push(foundProduct.productName);
        continue;
      }

      let quantity = Math.min(product.quantity, foundProduct.stock, 10);

      if (quantity !== product.quantity) {
        quantityAdjustments.push({
          productName: foundProduct.productName,
          oldQuantity: product.quantity,
          newQuantity: quantity,
          reason: quantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
        });
      }

      const amount = Number((foundProduct.price * quantity).toFixed(2));
      cartTotal += amount;
      totalQuantity += quantity;

      localCartProducts.push({
        id: product.productId,
        quantity,
        amount,
        productName: foundProduct.productName,
        thumbnail: foundProduct.thumbnail,
        price: foundProduct.price,
        brand: foundProduct.brand,
        subcategory: foundProduct.subcategory.subcategory,
        category: foundProduct.subcategory.category.category,
        stock: foundProduct.stock,
      });
    }

    return { cartTotal, totalQuantity, products: localCartProducts, removedItems, quantityAdjustments };
  }

  async addProductToCart(userId: number, productId: number, quantity: number, transactionalEntityManager?: EntityManager) {
    if (quantity > 10) {
      throw new AppError(ErrorType.QUANTITY_LIMIT_EXCEEDED);
    }
    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async transactionalEntityManager => {
      const [user, cart, foundProduct] = await Promise.all([
        transactionalEntityManager.findOne(User, { where: { id: userId } }),
        this.findOrCreateCart(userId, transactionalEntityManager),
        transactionalEntityManager.findOne(Product, { where: { id: productId } })
      ]);

      if (!user) throw new AppError(ErrorType.USER_NOT_FOUND);
      if (!foundProduct) throw new AppError(ErrorType.PRODUCT_NOT_FOUND);
      if (foundProduct.stock <= 0) throw new AppError(ErrorType.OUT_OF_STOCK);

      let cartItem = await transactionalEntityManager.findOne(CartItem, {
        where: { cart: cart, product: { id: productId } },
        relations: ["product"],
      });

      const currentQuantity = cartItem ? cartItem.quantity : 0;
      let newQuantity = Math.min(currentQuantity + quantity, 10, foundProduct.stock);
      const quantityChanges: QuantityChange[] = [];

      if (newQuantity !== currentQuantity + quantity) {
        quantityChanges.push({
          productName: foundProduct.productName,
          oldQuantity: currentQuantity + quantity,
          newQuantity,
          reason: newQuantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
        });
      }

      const quantityToAdd = newQuantity - currentQuantity;

      if (cartItem) {
        cartItem.quantity = newQuantity;
        cartItem.amount = newQuantity * foundProduct.price;
        cartItem.addedPrice = foundProduct.price;
      } else {
        cartItem = transactionalEntityManager.create(CartItem, {
          product: foundProduct,
          quantity: newQuantity,
          amount: newQuantity * foundProduct.price,
          cart: cart,
          addedPrice: foundProduct.price
        });
      }

      cart.totalQuantity += quantityToAdd;
      cart.cartTotal = Number(cart.cartTotal) + Number(quantityToAdd * foundProduct.price);

      await transactionalEntityManager.save(cartItem);
      await transactionalEntityManager.save(cart);

      const updatedCart = await this.getUserCart(userId, transactionalEntityManager);

      return {
        ...updatedCart,
        quantityChanges
      };
    });
  }

  async getBuyNowCartInfo(productId: number, quantity: number) {
    if (quantity > 10) {
      throw new AppError(ErrorType.QUANTITY_LIMIT_EXCEEDED);
    }

    const foundProduct = await this.productsRepo.findOne({
      where: { id: productId },
      relations: ["subcategory", "subcategory.category"],
    });

    if (!foundProduct) {
      throw new AppError(ErrorType.PRODUCT_NOT_FOUND, productId, foundProduct.productName);
    }

    if (foundProduct.stock < quantity) {
      throw new AppError(ErrorType.STOCK_LIMIT_EXCEEDED, productId, foundProduct.productName);
    }

    const amount = Number((foundProduct.price * quantity).toFixed(2));
    const cartTotal = amount;
    const totalQuantity = quantity;

    const product = {
      id: foundProduct.id,
      quantity: totalQuantity,
      amount,
      productName: foundProduct.productName,
      thumbnail: foundProduct.thumbnail,
      price: foundProduct.price,
      brand: foundProduct.brand,
      subcategory: foundProduct.subcategory.subcategory,
      category: foundProduct.subcategory.category.category,
      availableStock: foundProduct.stock,
    };

    return { cartTotal, totalQuantity, products: [product] };
  }

  async mergeLocalWithBackendCart(userId: number, localCartItems: CartItemDto[]) {
    return this.dataSource.transaction(async transactionalEntityManager => {
      const cart = await this.findOrCreateCart(userId, transactionalEntityManager);

      const existingItemsMap = new Map<number, CartItem>();
      cart.cartItems.forEach((item) => {
        existingItemsMap.set(item.product.id, item);
      });

      for (const localItem of localCartItems) {
        const existingProduct = existingItemsMap.get(localItem.productId);

        if (existingProduct) {
          const newQuantity = localItem.quantity + existingProduct.quantity;
          await this.updateCartItemQuantity(
            userId,
            localItem.productId,
            newQuantity,
            transactionalEntityManager
          );
        } else {
          await this.addProductToCart(
            userId,
            localItem.productId,
            localItem.quantity,
            transactionalEntityManager
          );
        }
      }

      return await this.getUserCart(userId, transactionalEntityManager);
    });
  }

  async updateCartItemQuantity(
    userId: number,
    productId: number,
    quantity: number,
    transactionalEntityManager?: EntityManager
  ) {
    if (quantity > 10) {
      throw new AppError(ErrorType.QUANTITY_LIMIT_EXCEEDED);
    }

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async (transactionManager) => {
      const [cart, cartItem] = await Promise.all([
        this.findOrCreateCart(userId, transactionManager),
        transactionManager.findOne(CartItem, {
          where: { cart: { user: { id: userId } }, product: { id: productId } },
          relations: ["product"],
        })
      ]);

      if (cartItem) {
        if (quantity > cartItem.product.stock) {
          throw new AppError(ErrorType.STOCK_LIMIT_EXCEEDED, productId, cartItem.product.productName);
        }

        const oldQuantity = cartItem.quantity;
        const oldAmount = oldQuantity * cartItem.product.price;
        const newAmount = quantity * cartItem.product.price;

        cartItem.quantity = quantity;
        cartItem.amount = newAmount;

        cart.totalQuantity += quantity - oldQuantity;
        cart.cartTotal = Number(cart.cartTotal) + Number(newAmount) - Number(oldAmount);

        await transactionManager.save(cartItem);
        await transactionManager.save(cart);

        return await this.getUserCart(userId, transactionManager);
      } else {
        return await this.addProductToCart(userId, productId, quantity, transactionManager);
      }
    });
  }

  async removeItemFromCart(userId: number, productId: number) {
    return this.dataSource.transaction(async transactionalEntityManager => {
      const [cart, productToRemove] = await Promise.all([
        this.findOrCreateCart(userId, transactionalEntityManager),
        transactionalEntityManager.findOne(CartItem, {
          where: { cart: { user: { id: userId } }, product: { id: productId } },
        }),
      ]);

      if (!productToRemove) {
        throw new AppError(ErrorType.PRODUCT_NOT_FOUND);
      }

      cart.totalQuantity -= productToRemove.quantity;
      cart.cartTotal = Number(cart.cartTotal) - Number(productToRemove.amount);

      await transactionalEntityManager.save(cart);
      await transactionalEntityManager.remove(productToRemove);

      return this.getUserCart(userId, transactionalEntityManager);
    });
  }
  
  async clearCart(userId: number) {
    return this.dataSource.transaction(async transactionalEntityManager => {
      const cart = await this.findOrCreateCart(userId, transactionalEntityManager);

      cart.cartTotal = 0;
      cart.totalQuantity = 0;
      cart.cartItems = [];

      await transactionalEntityManager.save(cart);
    });
  }
}
