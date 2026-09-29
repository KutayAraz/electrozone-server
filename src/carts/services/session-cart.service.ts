import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import Decimal from "decimal.js";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { getErrorMessage } from "src/common/errors/get-error-message";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { BuyNowSessionCart } from "src/entities/BuyNowSessionCart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { SessionCart } from "src/entities/SessionCart.entity";
import { CacheResult } from "src/redis/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";
import { DataSource, EntityManager, In, LessThan, Repository } from "typeorm";
import { CartOperationResponse } from "../types/cart-operation-response.type";
import { CartResponse } from "../types/cart-response.type";
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

    return manager.transaction(async transactionManager => {
      const cart = await this.cartUtilityService.findOrCreateSessionCart(
        sessionId,
        transactionManager,
      );

      // Get the cart items and any notification data
      const { cartItems, removedCartItems, priceChanges, quantityChanges } =
        await this.cartItemService.fetchAndUpdateCartItems(transactionManager, {
          sessionCartId: cart.id,
        });

      const { cartTotal, totalQuantity } = this.cartUtilityService.calculateTotals(cartItems);

      if (cart.cartTotal !== cartTotal || cart.totalQuantity !== totalQuantity) {
        await transactionManager.update(SessionCart, cart.id, { cartTotal, totalQuantity });
        await this.invalidateSessionCartCache(sessionId);
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

      for (const sessionCartItem of existingSessionCart.cartItems) {
        if (!sessionCartItem.product || sessionCartItem.product.stock <= 0) {
          continue;
        }

        await this.cartService.addProductToCart(
          userUuid,
          sessionCartItem.product.id,
          sessionCartItem.quantity,
          transactionalEntityManager,
        );
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
      await this.cartService.invalidateUserCartCache(userUuid);

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
      await this.redisService.del(
        this.redisService.generateKey("session-cart-count", { sessionId }),
      );
      this.logger.debug(`Invalidated cart count cache for session ${sessionId}`);
    } catch (error) {
      this.logger.error("Failed to invalidate session caches:", error);
    }
  }

  /**
   * Cleanup old session and buy-now carts daily at 5 AM
   * Deletes carts older than 14 days (2x session lifetime for safety)
   */
  @Cron("0 5 * * *")
  async cleanupOldSessionCarts(): Promise<void> {
    try {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const deletedCartCount = await this.dataSource.transaction(async transactionManager => {
        const staleCarts = await transactionManager.find(SessionCart, {
          select: ["id"],
          where: { updatedAt: LessThan(fourteenDaysAgo) },
        });

        if (staleCarts.length === 0) return 0;

        const staleCartIds = staleCarts.map(cart => cart.id);

        // cart_items.sessionCartId has no ON DELETE CASCADE
        await transactionManager
          .createQueryBuilder()
          .delete()
          .from(CartItem)
          .where("sessionCartId IN (:...staleCartIds)", { staleCartIds })
          .execute();
        const { affected } = await transactionManager.delete(SessionCart, {
          id: In(staleCartIds),
        });

        return affected || 0;
      });

      const deletedBuyNowCarts = await this.dataSource.manager.delete(BuyNowSessionCart, {
        createdAt: LessThan(fourteenDaysAgo),
      });

      this.logger.log(
        `Cleaned up ${deletedCartCount} session carts and ` +
          `${deletedBuyNowCarts.affected || 0} buy-now carts older than 14 days`,
      );
    } catch (error) {
      this.logger.error(`Failed to cleanup old session carts: ${getErrorMessage(error)}`);
    }
  }
}
