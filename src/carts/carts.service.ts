import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { EntityNotFoundError, In, Repository } from "typeorm";
import { CartItemDto } from "./dtos/cart-item.dto";
import { FormattedCartProduct } from "./types/formatted-cart-product.type";
import { PriceChange } from "./types/price-change.type";
import { LocalCartResponse } from "./types/local-cart-response.type";
import CartResponse from "./types/cart-response.type";
import QuantityChange from "./types/quantity-change.type";

@Injectable()
export class CartsService {
  private readonly logger = new Logger(CartsService.name);

  constructor(
    @InjectRepository(Cart) private cartsRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemsRepo: Repository<CartItem>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) { }

  async getUserCart(userId: number): Promise<CartResponse> {
    try {
      const cart = await this.cartsRepo.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });

      if (!cart) {
        const user = await this.usersRepo.findOneBy({ id: userId });
        if (!user) {
          throw new NotFoundException('User not found');
        }

        const newCart = this.cartsRepo.create({
          user,
          cartTotal: 0,
          totalQuantity: 0,
        });
        await this.cartsRepo.save(newCart);
        return { cartTotal: 0, totalQuantity: 0, products: [], removedItems: [], priceChanges: [], quantityChanges: [] };
      }

      const { products, removedItems, priceChanges, quantityChanges } = await this.fetchAndUpdateCartProducts(cart.id);

      // Recalculate cart total and quantity
      const cartTotal = products.reduce((total, product) => total + product.amount, 0);
      const totalQuantity = products.reduce((total, product) => total + product.quantity, 0);

      // Update cart in database
      await this.cartsRepo.update(cart.id, { cartTotal, totalQuantity });

      return {
        cartTotal,
        totalQuantity,
        products,
        removedItems,
        priceChanges,
        quantityChanges,
      };
    } catch (error) {
      this.logger.error(`Error fetching user cart: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Unable to retrieve cart');
    }
  }

  private async fetchAndUpdateCartProducts(cartId: number): Promise<{
    products: FormattedCartProduct[],
    removedItems: string[],
    priceChanges: PriceChange[],
    quantityChanges: QuantityChange[]
  }> {
    const products = await this.cartItemsRepo
      .createQueryBuilder("cartItem")
      .select([
        "cartItem.id",
        "cartItem.quantity",
        "cartItem.amount",
        "cartItem.addedPrice",
        "product.productName",
        "product.averageRating",
        "product.thumbnail",
        "product.price",
        "product.id",
        "product.stock",
        "subcategory.subcategory",
        "category.category",
      ])
      .innerJoin("cartItem.product", "product")
      .innerJoin("product.subcategory", "subcategory")
      .innerJoin("subcategory.category", "category")
      .where("cartItem.cartId = :cartId", { cartId })
      .getMany();

    const formattedProducts: FormattedCartProduct[] = [];
    const removedItems: string[] = [];
    const priceChanges: PriceChange[] = [];
    const quantityChanges: QuantityChange[] = [];

    for (const product of products) {
      if (product.product.stock > 0) {
        const currentPrice = product.product.price;
        const addedPrice = product.addedPrice;
        let quantity = product.quantity;

        // Check if quantity exceeds stock or 10-item limit
        if (quantity > product.product.stock || quantity > 10) {
          const oldQuantity = quantity;
          quantity = Math.min(product.product.stock, 10);

          quantityChanges.push({
            productName: product.product.productName,
            oldQuantity: oldQuantity,
            newQuantity: quantity,
            reason: quantity === 10 ? 'QUANTITY_LIMIT_EXCEEDED' : 'STOCK_LIMIT_EXCEEDED'
          });

          // Update the cart item with the new quantity
          await this.cartItemsRepo.update(product.id, {
            quantity: quantity,
            amount: currentPrice * quantity
          });
        }

        if (addedPrice !== null && addedPrice !== undefined && currentPrice !== addedPrice) {
          priceChanges.push({
            productName: product.product.productName,
            oldPrice: addedPrice,
            newPrice: currentPrice,
          });

          // Update the cart item with the new price
          await this.cartItemsRepo.update(product.id, {
            addedPrice: currentPrice,
            amount: currentPrice * quantity
          });
        }

        formattedProducts.push({
          cartItemId: product.id,
          quantity: quantity,
          amount: currentPrice * quantity,
          id: product.product.id,
          productName: product.product.productName,
          avgRating: product.product.averageRating,
          thumbnail: product.product.thumbnail,
          price: currentPrice,
          subcategory: product.product.subcategory.subcategory,
          category: product.product.subcategory.category.category,
        });
      } else {
        await this.cartItemsRepo.delete(product.id);
        removedItems.push(product.product.productName);
      }
    }

    return { products: formattedProducts, removedItems, priceChanges, quantityChanges };
  }

  async getLocalCartInformation(products: CartItemDto[]): Promise<LocalCartResponse> {
    if (!Array.isArray(products)) {
      throw new BadRequestException("Expected an array of products");
    }

    const productIds = products.map(product => product.productId);
    const foundProducts = await this.productsRepo.find({
      where: {
        id: In(productIds),
      },
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
      if (!foundProduct) {
        console.warn(`Product with id ${product.productId} not found`);
        continue;
      }

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
          reason: quantity === 10 ? 'QUANTITY_LIMIT_EXCEEDED' : 'STOCK_LIMIT_EXCEEDED'
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

    const response: LocalCartResponse = {
      cartTotal,
      totalQuantity,
      products: localCartProducts,
      removedItems,
      quantityAdjustments,
    };

    return response;
  }

  async addProductToCart(userId: number, productId: number, quantity: number) {
    const user = await this.usersRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let cart = await this.cartsRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!cart) {
      cart = new Cart();
      cart.user = user;
      cart.totalQuantity = 0;
      cart.cartTotal = 0;
      await this.cartsRepo.save(cart);
    }

    const foundProduct = await this.productsRepo.findOneBy({ id: productId });
    if (!foundProduct) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    if (foundProduct.stock <= 0) {
      throw new BadRequestException('OUT_OF_STOCK');
    }

    let cartItem = await this.cartItemsRepo.findOne({
      where: { cart, product: { id: productId } },
      relations: ["product"],
    });

    const currentQuantity = cartItem ? cartItem.quantity : 0;
    let newQuantity = currentQuantity + quantity;
    const quantityChanges: QuantityChange[] = [];

    // Check if total quantity exceeds 10
    if (newQuantity > 10) {
      quantityChanges.push({
        productName: foundProduct.productName,
        oldQuantity: newQuantity,
        newQuantity: 10,
        reason: 'QUANTITY_LIMIT_EXCEEDED'
      });
      newQuantity = 10;
    }

    // Check if total quantity exceeds available stock
    if (newQuantity > foundProduct.stock) {
      quantityChanges.push({
        productName: foundProduct.productName,
        oldQuantity: newQuantity,
        newQuantity: foundProduct.stock,
        reason: 'STOCK_LIMIT_EXCEEDED'
      });
      newQuantity = foundProduct.stock;
    }

    const quantityToAdd = newQuantity - currentQuantity;

    if (cartItem) {
      cartItem.quantity = newQuantity;
      cartItem.amount = newQuantity * foundProduct.price;
      cartItem.addedPrice = foundProduct.price; // Update the added price
    } else {
      cartItem = new CartItem();
      cartItem.product = foundProduct;
      cartItem.quantity = newQuantity;
      cartItem.amount = newQuantity * foundProduct.price;
      cartItem.cart = cart;
      cartItem.addedPrice = foundProduct.price; // Set the added price
    }

    cart.totalQuantity += quantityToAdd;
    cart.cartTotal = Number(cart.cartTotal) + Number(quantityToAdd * foundProduct.price);

    await this.cartItemsRepo.save(cartItem);
    await this.cartsRepo.save(cart);

    const updatedCart = await this.getUserCart(userId);

    return {
      ...updatedCart,
      quantityChanges
    };
  }

  async getBuyNowCartInfo(productId: number, quantity: number) {
    const foundProduct = await this.productsRepo.findOne({
      where: { id: productId },
      relations: ["subcategory", "subcategory.category"],
    });

    if(quantity > 10){
      throw new NotFoundException("QUANTITY_LIMIT_EXCEED")
    }

    if (!foundProduct) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    if (foundProduct.stock < quantity) {
      throw new BadRequestException('STOCK_LIMIT_EXCEEDED');
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

    return {
      cartTotal,
      totalQuantity,
      products: [product],
    };
  }

  async mergeLocalWithBackendCart(
    userId: number,
    localCartItems: CartItemDto[],
  ) {
    const user = await this.usersRepo.findOneBy({ id: userId });

    let backendCart = await this.cartsRepo.findOne({
      where: { user: { id: userId } },
      relations: ["products", "products.product"],
    });

    if (!backendCart) {
      backendCart = new Cart();
      backendCart.user = user;
      backendCart.cartItems = [];
      await this.cartsRepo.save(backendCart);
    }

    const existingItemsMap = new Map<number, CartItem>();
    backendCart.cartItems.forEach((item) => {
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
        );
      } else {
        await this.addProductToCart(
          userId,
          localItem.productId,
          localItem.quantity,
        );
      }
    }

    return await this.getUserCart(userId);
  }

  async updateCartItemQuantity(
    userId: number,
    productId: number,
    quantity: number,
  ) {
    // Use a single query to get both cart and cart item
    const [cart, cartItem] = await Promise.all([
      this.cartsRepo.findOne({
        where: { user: { id: userId } },
      }),
      this.cartItemsRepo.findOne({
        where: { cart: { user: { id: userId } }, product: { id: productId } },
        relations: ["product"],
      })
    ]);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (cartItem) {
      // Check if the new total quantity exceeds the stock
      const newTotalQuantity = quantity + (cartItem.quantity || 0);
      if (newTotalQuantity > cartItem.product.stock) {
        throw new BadRequestException('STOCK_EXCEEDED');
      }

      const oldQuantity = cartItem.quantity;
      const oldAmount = oldQuantity * cartItem.product.price;
      const newAmount = quantity * cartItem.product.price;

      // Update cart item
      cartItem.quantity = quantity;
      cartItem.amount = newAmount;

      // Update cart totals
      cart.totalQuantity += quantity - oldQuantity;
      cart.cartTotal = Number(cart.cartTotal) + Number(newAmount) - Number(oldAmount);

      // Save changes in a single transaction
      await this.cartsRepo.manager.transaction(async (transactionalEntityManager) => {
        await transactionalEntityManager.save(cartItem);
        await transactionalEntityManager.save(cart);
      });

      return await this.getUserCart(userId);
    } else {
      // Check if the quantity exceeds the stock before adding to cart
      const product = await this.productsRepo.findOne({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      if (quantity > product.stock) {
        throw new BadRequestException('STOCK_EXCEEDED');
      }
      return await this.addProductToCart(userId, productId, quantity);
    }
  }

  async removeItemFromCart(userId: number, productId: number) {
    const [cart, productToRemove] = await Promise.all([
      this.cartsRepo.findOne({
        where: { user: { id: userId } },
      }),
      this.cartItemsRepo.findOne({
        where: { cart: { user: { id: userId } }, product: { id: productId } },
      }),
    ]);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (!productToRemove) {
      throw new NotFoundException('Product not found in cart');
    }

    cart.totalQuantity -= productToRemove.quantity;
    cart.cartTotal = Number(cart.cartTotal) - Number(productToRemove.amount);

    await Promise.all([
      this.cartsRepo.save(cart),
      this.cartItemsRepo.remove(productToRemove),
    ]);

    return this.getUserCart(userId);
  }

  async clearCart(userId: number) {
    const cart = await this.cartsRepo.findOne({
      where: { user: { id: userId } },
      relations: ['cartItems'],
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    cart.cartTotal = 0;
    cart.totalQuantity = 0;
    cart.cartItems = [];

    await this.cartsRepo.save(cart);

    return { success: true, message: "Cart cleared successfully." };
  }
}
