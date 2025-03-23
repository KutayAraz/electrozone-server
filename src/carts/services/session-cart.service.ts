import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import Decimal from "decimal.js";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { SessionCart } from "src/entities/SessionCart.entity";
import { CacheResult } from "src/redis/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";
import { DataSource, EntityManager, Repository } from "typeorm";
import { CartOperationResponse } from "../types/cart-operation-response.type";
import { CartResponse } from "../types/cart-response.type";
import { QuantityChange } from "../types/quantity-change.type";
import { CartItemService } from "./cart-item.service";
import { CartUtilityService } from "./cart-utility.service";
import { CartService } from "./cart.service";

@Injectable()
export class SessionCartService {
  private readonly logger = new Logger(SessionCartService.name);

  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
    private readonly commonValidationService: CommonValidationService,
    private readonly cartItemService: CartItemService,
    private readonly cartUtilityService: CartUtilityService,
    private readonly cartService: CartService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @CacheResult({
    prefix: "session-cart",
    ttl: 3600,
    paramKeys: ["sessionId"],
  })
  async getSessionCart(
    sessionId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartResponse> {
    this.commonValidationService.validateSessionId(sessionId);
    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async transactionManager => {
      let cart = await this.cartUtilityService.findOrCreateSessionCart(
        sessionId,
        transactionManager,
      );

      // Update the cart items and notify user of any changes to product price or stock change
      const { cartItems, removedCartItems, priceChanges, quantityChanges } =
        await this.cartItemService.fetchAndUpdateCartItems(transactionManager, {
          sessionCartId: cart.id,
        });

      // Recalculate cart total and quantity
      const cartTotal = cartItems
        .reduce((total, product) => {
          return total.plus(new Decimal(product.amount));
        }, new Decimal(0))
        .toFixed(2);
      const totalQuantity = cartItems.reduce((total, product) => total + product.quantity, 0);

      // Check if any changes were detected that warrant cache invalidation
      const hasChanges =
        (removedCartItems && removedCartItems.length > 0) ||
        (priceChanges && priceChanges.length > 0) ||
        (quantityChanges && quantityChanges.length > 0);

      // If changes were detected, invalidate the cache after this request completes
      if (hasChanges) {
        process.nextTick(() => {
          this.invalidateSessionCartCache(sessionId).catch(err => {
            this.logger.error(`Failed to invalidate cache after cart changes: ${err.message}`);
          });
        });
      }

      return {
        cartTotal,
        totalQuantity,
        cartItems,
        removedCartItems,
        priceChanges,
        quantityChanges,
      };
    });
  }

  @CacheResult({
    prefix: "session-cart-count",
    ttl: 3600,
    paramKeys: ["sessionId"],
  })
  async getSessionCartCount(sessionId: string): Promise<{ count: number }> {
    try {
      this.commonValidationService.validateSessionId(sessionId);

      const cart = await this.dataSource.manager.findOne(SessionCart, {
        where: { sessionId },
        select: ["totalQuantity"],
      });

      return { count: cart?.totalQuantity || 0 };
    } catch (error) {
      this.logger.error(`Failed to get cart count for session ${sessionId}:`, error);
      return { count: 0 };
    }
  }

  async addToSessionCart(
    sessionId: string,
    productId: number,
    quantity: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartOperationResponse> {
    this.commonValidationService.validateSessionId(sessionId);
    this.commonValidationService.validateQuantity(quantity);

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async transactionManager => {
      const [sessionCart, product] = await Promise.all([
        this.cartUtilityService.findOrCreateSessionCart(sessionId, transactionManager),
        this.productRepository.findOne({ where: { id: productId } }),
      ]);

      const quantityChange = await this.cartItemService.addCartItem(
        sessionCart,
        product,
        quantity,
        transactionManager,
      );

      return {
        success: true,
        quantityChanges: quantityChange ? [quantityChange] : undefined,
      };
    });
  }

  async updateCartItemQuantity(
    sessionId: string,
    productId: number,
    quantity: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartOperationResponse> {
    this.commonValidationService.validateSessionId(sessionId);
    this.commonValidationService.validateQuantity(quantity);

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async transactionManager => {
      // Find both session cart and cartItem in parallel execution
      const [sessionCart, cartItem] = await Promise.all([
        this.cartUtilityService.findOrCreateSessionCart(sessionId, transactionManager),
        transactionManager.findOne(CartItem, {
          where: { sessionCart: { sessionId }, product: { id: productId } },
          relations: ["product"],
        }),
      ]);

      let quantityChanges: QuantityChange[] = [];
      let priceChanges = [];

      // If cartItem exists, update its quantity
      if (cartItem) {
        const { updatedCartItem, quantityChange, priceChange } =
          await this.cartItemService.updateCartItem(cartItem, transactionManager);

        await this.cartItemService.updateCartItemQuantity(
          sessionCart,
          cartItem,
          quantity,
          transactionManager,
        );

        if (quantityChange) quantityChanges.push(quantityChange);
        if (priceChange) priceChanges.push(priceChange);
      } else {
        // If cartItem doesn't exist, treat it as a new item addition
        const product = await this.productRepository.findOne({
          where: { id: productId },
        });

        const quantityChange = await this.cartItemService.addCartItem(
          sessionCart,
          product,
          quantity,
          transactionManager,
        );

        if (quantityChange) quantityChanges.push(quantityChange);
      }

      // Invalidate cache after updating quantity
      await this.invalidateSessionCartCache(sessionId);

      return {
        success: true,
        quantityChanges: quantityChanges.length > 0 ? quantityChanges : undefined,
        priceChanges: priceChanges.length > 0 ? priceChanges : undefined,
      };
    });
  }

  async removeFromSessionCart(
    sessionId: string,
    productId: number,
  ): Promise<CartOperationResponse> {
    this.commonValidationService.validateSessionId(sessionId);

    return this.dataSource.transaction(async transactionManager => {
      const [sessionCart, cartItem] = await Promise.all([
        this.cartUtilityService.findOrCreateSessionCart(sessionId, transactionManager),
        transactionManager.findOne(CartItem, {
          where: {
            sessionCart: { sessionId },
            product: { id: productId },
          },
          relations: ["product"],
        }),
      ]);

      if (cartItem) {
        await this.cartItemService.removeCartItem(sessionCart, cartItem, transactionManager);
      } else {
        throw new AppError(
          ErrorType.CART_ITEM_NOT_FOUND,
          "This product is already not in your cart",
        );
      }

      // Invalidate cache after removing product
      await this.invalidateSessionCartCache(sessionId);

      return { success: true };
    });
  }

  async mergeCarts(sessionId: string, userUuid: string): Promise<CartResponse> {
    this.commonValidationService.validateSessionId(sessionId);

    return this.dataSource.transaction(async transactionalEntityManager => {
      // First, check if a session cart exists
      const existingSessionCart = await transactionalEntityManager.findOne(SessionCart, {
        where: { sessionId },
        relations: ["cartItems", "cartItems.product"],
      });

      // If no session cart exists or it has no items, just return the user cart
      if (!existingSessionCart || existingSessionCart.cartItems.length === 0) {
        return await this.cartService.getUserCart(userUuid, transactionalEntityManager);
      }

      // Since we have items to merge, get or create the user cart
      const userCart = await this.cartUtilityService.findOrCreateCart(
        userUuid,
        transactionalEntityManager,
      );

      // Create a map of existing items in the user's cart for quick lookup
      const existingItemsMap = new Map<number, CartItem>();
      userCart.cartItems.forEach(item => {
        existingItemsMap.set(item.product.id, item);
      });

      for (const sessionCartItem of existingSessionCart.cartItems) {
        // Check if the product already exists in the user's cart
        const existingProduct = existingItemsMap.get(sessionCartItem.product.id);

        if (existingProduct) {
          // If the product exists, update the quantity
          const newQuantity = sessionCartItem.quantity + existingProduct.quantity;
          await this.cartService.updateCartItemQuantity(
            userUuid,
            sessionCartItem.id,
            newQuantity,
            transactionalEntityManager,
          );
        } else {
          // If the product doesn't exist, add it to the user's cart
          await this.cartService.addProductToCart(
            userUuid,
            sessionCartItem.id,
            sessionCartItem.quantity,
            transactionalEntityManager,
          );
        }
      }

      // Clean up: Delete the session cart and its items after merging
      await transactionalEntityManager.delete(CartItem, {
        sessionCart: { id: existingSessionCart.id },
      });
      await transactionalEntityManager.delete(SessionCart, {
        id: existingSessionCart.id,
      });

      // Invalidate cache for both session-cart and user-cart after merging carts
      await this.invalidateSessionCartCache(sessionId);
      try {
        const cacheKeys = [
          this.redisService.generateKey("cart-user", { userUuid }),
          this.redisService.generateKey("cart-count", { userUuid }),
        ];
        await Promise.all(cacheKeys.map(key => this.redisService.del(key)));
        this.logger.debug(`Invalidated cache keys for user ${userUuid}`);
      } catch (error) {
        this.logger.error("Failed to invalidate user caches:", error);
      }

      // Return the updated user cart
      return await this.cartService.getUserCart(userUuid, transactionalEntityManager);
    });
  }

  async clearSessionCart(
    sessionId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartOperationResponse> {
    this.commonValidationService.validateSessionId(sessionId);

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async transactionManager => {
      // Find or create the session cart
      const sessionCart = await this.cartUtilityService.findOrCreateSessionCart(
        sessionId,
        transactionManager,
      );

      // Delete all cart items first
      await transactionManager.delete(CartItem, {
        sessionCart: { id: sessionCart.id },
      });

      // Reset the cart totals
      sessionCart.cartTotal = new Decimal(0).toFixed(2);
      sessionCart.totalQuantity = 0;

      // Save the updated cart
      await transactionManager.save(sessionCart);

      // Invalidate cache clearing session cart
      await this.invalidateSessionCartCache(sessionId);

      return {
        success: true,
      };
    });
  }

  // Helper method to invalidate session cart cache
  private async invalidateSessionCartCache(sessionId: string): Promise<void> {
    try {
      const cacheKeys = [
        this.redisService.generateKey("session-cart", { sessionId }),
        this.redisService.generateKey("session-cart-count", { sessionId }),
      ];

      await Promise.all(cacheKeys.map(key => this.redisService.del(key)));
      this.logger.debug(`Invalidated cache keys for session ${sessionId}`);
    } catch (error) {
      this.logger.error("Failed to invalidate session caches:", error);
    }
  }
}
