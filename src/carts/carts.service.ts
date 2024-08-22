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
import { ErrorMessages } from "src/common/constants/error-messages";

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
      try {
        const cart = await transactionManager.findOne(Cart, {
          where: { user: { id: userId } },
          relations: ['user'],
        });

        if (!cart) {
          const user = await transactionManager.findOne(User, { where: { id: userId } });
          if (!user) {
            throw new NotFoundException('USER_NOT_FOUND');
          }

          const newCart = transactionManager.create(Cart, {
            user,
            cartTotal: 0,
            totalQuantity: 0,
          });
          await transactionManager.save(newCart);
          return { cartTotal: 0, totalQuantity: 0, products: [], removedItems: [], priceChanges: [], quantityChanges: [] };
        }

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
      } catch (error) {
        this.logger.error(`Error fetching user cart: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Unable to retrieve cart');
      }
    });
  }

  private async fetchAndUpdateCartProducts(cartId: number, transactionManager: EntityManager): Promise<{
    products: FormattedCartProduct[],
    removedItems: string[],
    priceChanges: PriceChange[],
    quantityChanges: QuantityChange[]
  }> {
    const products = await transactionManager
      .createQueryBuilder(CartItem, "cartItem")
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
          await transactionManager.update(CartItem, product.id, {
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
          await transactionManager.update(CartItem, product.id, {
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
        await transactionManager.delete(Product, product.id);
        removedItems.push(product.product.productName);
      }
    }

    return { products: formattedProducts, removedItems, priceChanges, quantityChanges };
  }

  async getLocalCartInformation(products: CartItemDto[]): Promise<LocalCartResponse> {
    try {
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
    } catch (error) {
      this.logger.error(`Error in getLocalCartInformation: ${error.message}`, error.stack);

      if (error instanceof BadRequestException) {
        throw error; // Re-throw BadRequestException as is
      }

      if (error instanceof QueryFailedError) {
        // Handle database query errors
        throw new InternalServerErrorException('An error occurred while fetching product information');
      }

      // For any other unexpected errors
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async addProductToCart(userId: number, productId: number, quantity: number, transactionalEntityManager?: EntityManager) {
    if (quantity > 10) {
      throw new BadRequestException('QUANTITY_LIMIT_EXCEEDED');
    }
    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async transactionalEntityManager => {
      // Fetch user, cart, and product in a single query if possible
      const [user, cart, foundProduct] = await Promise.all([
        transactionalEntityManager.findOne(User, { where: { id: userId } }),
        transactionalEntityManager.findOne(Cart, { where: { user: { id: userId } } }),
        transactionalEntityManager.findOne(Product, { where: { id: productId } })
      ]);

      if (!user) throw new NotFoundException('USER_NOT_FOUND');
      if (!foundProduct) throw new NotFoundException('PRODUCT_NOT_FOUND');
      if (foundProduct.stock <= 0) throw new BadRequestException('OUT_OF_STOCK');

      let newCart = cart;
      if (!newCart) {
        newCart = manager.create(Cart, {
          user,
          totalQuantity: 0,
          cartTotal: 0
        });
      }

      let cartItem = await transactionalEntityManager.findOne(CartItem, {
        where: { cart: newCart, product: { id: productId } },
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
          reason: newQuantity === 10 ? 'QUANTITY_LIMIT_EXCEEDED' : 'STOCK_LIMIT_EXCEEDED'
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
          cart: newCart,
          addedPrice: foundProduct.price
        });
      }

      newCart.totalQuantity += quantityToAdd;
      newCart.cartTotal = Number(newCart.cartTotal) + Number(quantityToAdd * foundProduct.price);

      await transactionalEntityManager.save(cartItem);
      await transactionalEntityManager.save(newCart);

      const updatedCart = await this.getUserCart(userId, transactionalEntityManager);

      return {
        ...updatedCart,
        quantityChanges
      };
    });
  }

  async getBuyNowCartInfo(productId: number, quantity: number) {
    if (quantity > 10) {
      throw new BadRequestException("QUANTITY_LIMIT_EXCEED")
    }
    try {
      const foundProduct = await this.productsRepo.findOne({
        where: { id: productId },
        relations: ["subcategory", "subcategory.category"],
      });

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
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      } else {
        throw new Error('An unexpected error occurred while getting the buy-now cart info.');
      }
    }
  }

  async mergeLocalWithBackendCart(userId: number, localCartItems: CartItemDto[]) {
    return this.dataSource.transaction(async transactionalEntityManager => {
      const user = await transactionalEntityManager.findOne(User, { where: { id: userId } });

      let backendCart = await transactionalEntityManager.findOne(Cart, {
        where: { user: { id: userId } },
        relations: ["products", "products.product"],
      });

      if (!backendCart) {
        backendCart = transactionalEntityManager.create(Cart, {
          user,
          cartItems: []
        });
        await transactionalEntityManager.save(backendCart);
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
      throw new BadRequestException("QUANTITY_LIMIT_EXCEED")
    }

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async (transactionManager) => {
      const [cart, cartItem] = await Promise.all([
        transactionManager.findOne(Cart, {
          where: { user: { id: userId } },
        }),
        transactionManager.findOne(CartItem, {
          where: { cart: { user: { id: userId } }, product: { id: productId } },
          relations: ["product"],
        })
      ]);

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cartItem) {
        const newTotalQuantity = quantity + (cartItem.quantity || 0);
        if (newTotalQuantity > cartItem.product.stock) {
          throw new BadRequestException('STOCK_EXCEEDED');
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
        const product = await transactionManager.findOne(Product, { where: { id: productId } });
        if (!product) {
          throw new NotFoundException(ErrorMessages.PRODUCT_NOT_FOUND);
        }
        if (quantity > product.stock) {
          throw new BadRequestException('STOCK_EXCEEDED');
        }
        return await this.addProductToCart(userId, productId, quantity, transactionManager);
      }
    });
  }

  async removeItemFromCart(userId: number, productId: number) {
    return this.dataSource.transaction(async transactionalEntityManager => {
      const [cart, productToRemove] = await Promise.all([
        transactionalEntityManager.findOne(Cart, {
          where: { user: { id: userId } },
        }),
        transactionalEntityManager.findOne(CartItem, {
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

      await transactionalEntityManager.save(cart);
      await transactionalEntityManager.remove(productToRemove);

      return this.getUserCart(userId, transactionalEntityManager);
    });
  }

  async clearCart(userId: number) {
    return this.dataSource.transaction(async transactionalEntityManager => {
      const cart = await transactionalEntityManager.findOne(Cart, {
        where: { user: { id: userId } },
        relations: ['cartItems'],
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      cart.cartTotal = 0;
      cart.totalQuantity = 0;
      cart.cartItems = [];

      await transactionalEntityManager.save(cart);

      return
    });
  }
}
