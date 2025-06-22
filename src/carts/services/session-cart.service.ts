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
import { FormattedCartItem } from "../types/formatted-cart-item.type";
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

  async getSessionCart(
    sessionId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartResponse> {
    this.commonValidationService.validateSessionId(sessionId);
    const manager = transactionalEntityManager || this.dataSource.manager;
    const cacheKey = this.redisService.generateKey("session-cart", { sessionId });

    // Try to get the core cart data from cache
    const cachedCartData = await this.redisService.get<{
      cartTotal: string;
      totalQuantity: number;
      cartItems: FormattedCartItem[];
    }>(cacheKey);

    if (cachedCartData) {
      // We have cached cart data, but need to calculate notifications
      return manager.transaction(async transactionManager => {
        let cart = await this.cartUtilityService.findOrCreateSessionCart(
          sessionId,
          transactionManager,
        );

        // Check for any changes/notifications
        const { removedCartItems, priceChanges, quantityChanges } =
          await this.cartItemService.fetchAndUpdateCartItems(transactionManager, {
            sessionCartId: cart.id,
          });

        // If there are changes, invalidate the cache for next time
        const hasChanges =
          (removedCartItems && removedCartItems.length > 0) ||
          (priceChanges && priceChanges.length > 0) ||
          (quantityChanges && quantityChanges.length > 0);

        if (hasChanges) {
          process.nextTick(() => {
            this.invalidateSessionCartCache(sessionId).catch(err => {
              this.logger.error(`Failed to invalidate cache after cart changes: ${err.message}`);
            });
          });
        }

        // Return cached data + fresh notifications
        return {
          ...cachedCartData,
          removedCartItems,
          priceChanges,
          quantityChanges,
        };
      });
    } else {
      // No cache hit, need to calculate everything
      return manager.transaction(async transactionManager => {
        let cart = await this.cartUtilityService.findOrCreateSessionCart(
          sessionId,
          transactionManager,
        );

        // Get the cart items and any notification data
        const { cartItems, removedCartItems, priceChanges, quantityChanges } =
          await this.cartItemService.fetchAndUpdateCartItems(transactionManager, {
            sessionCartId: cart.id,
          });

        // Calculate totals
        const cartTotal = cartItems
          .reduce((total, product) => {
            return total.plus(new Decimal(product.amount));
          }, new Decimal(0))
          .toFixed(2);

        const totalQuantity = cartItems.reduce((total, product) => total + product.quantity, 0);

        // Cache only the core data
        const coreCartData = {
          cartTotal,
          totalQuantity,
          cartItems,
        };

        await this.redisService.trackProductReference(cacheKey, coreCartData, 3600);

        return {
          ...coreCartData,
          removedCartItems,
          priceChanges,
          quantityChanges,
        };
      });
    }
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

      await this.invalidateSessionCartCache(sessionId);

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

      // If cartItem exists, update its quantity
      if (cartItem) {
        await this.cartItemService.updateCartItemQuantity(
          sessionCart,
          cartItem,
          quantity,
          transactionManager,
        );
      } else {
        // If cartItem doesn't exist, treat it as a new item addition
        const product = await this.productRepository.findOne({
          where: { id: productId },
        });

        await this.cartItemService.addCartItem(sessionCart, product, quantity, transactionManager);
      }

      // Invalidate cache after updating quantity
      await this.invalidateSessionCartCache(sessionId);

      return {
        success: true,
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

  async mergeCarts(userUuid: string, sessionId: string): Promise<CartResponse> {
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

      // Since we have items to merge, get or create the user cart WITH relations
      const userCart = await this.cartUtilityService.findOrCreateCart(
        userUuid,
        transactionalEntityManager,
      );

      // Create a map of existing items in the user's cart for quick lookup
      const existingItemsMap = new Map<number, CartItem>();

      // Make sure cartItems are loaded
      if (userCart.cartItems && userCart.cartItems.length > 0) {
        userCart.cartItems.forEach(item => {
          existingItemsMap.set(item.product.id, item);
        });
      }

      for (const sessionCartItem of existingSessionCart.cartItems) {
        // Check if the product already exists in the user's cart
        const existingProduct = existingItemsMap.get(sessionCartItem.product.id);

        if (existingProduct) {
          // If the product exists, update the quantity
          const newQuantity = sessionCartItem.quantity + existingProduct.quantity;

          await this.cartService.updateCartItemQuantity(
            userUuid,
            sessionCartItem.product.id,
            newQuantity,
            transactionalEntityManager,
          );
        } else {
          // If the product doesn't exist, add it to the user's cart
          await this.cartService.addProductToCart(
            userUuid,
            sessionCartItem.product.id,
            sessionCartItem.quantity,
            transactionalEntityManager,
          );
        }
      }

      // Delete the session cart and its items after merging
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
