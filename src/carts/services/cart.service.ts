import { Injectable, Logger } from "@nestjs/common";
import Decimal from "decimal.js";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { CacheResult } from "src/redis/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";
import { DataSource, EntityManager } from "typeorm";
import { CartOperationResponse } from "../types/cart-operation-response.type";
import { CartResponse } from "../types/cart-response.type";
import { FormattedCartItem } from "../types/formatted-cart-item.type";
import { CartItemService } from "./cart-item.service";
import { CartUtilityService } from "./cart-utility.service";

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly cartItemService: CartItemService,
    private readonly cartUtilityService: CartUtilityService,
    private readonly commonValidationService: CommonValidationService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async getUserCart(
    userUuid: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartResponse> {
    const manager = transactionalEntityManager || this.dataSource.manager;
    const cacheKey = this.redisService.generateKey("cart-user", { userUuid });

    // Try to get the core cart data from cache
    const cachedCartData = await this.redisService.get<{
      cartTotal: string;
      totalQuantity: number;
      cartItems: FormattedCartItem[];
    }>(cacheKey);

    if (cachedCartData) {
      // We have cached cart data, but need to calculate notifications
      return manager.transaction(async transactionManager => {
        let cart = await this.cartUtilityService.findOrCreateCart(userUuid, transactionManager);

        // Check for any changes/notifications
        const { removedCartItems, priceChanges, quantityChanges } =
          await this.cartItemService.fetchAndUpdateCartItems(transactionManager, {
            cartId: cart.id,
          });

        // If there are changes, invalidate the cache for next time
        const hasChanges =
          (removedCartItems && removedCartItems.length > 0) ||
          (priceChanges && priceChanges.length > 0) ||
          (quantityChanges && quantityChanges.length > 0);

        if (hasChanges) {
          process.nextTick(() => {
            this.invalidateUserCartCache(userUuid).catch(err => {
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
        let cart = await this.cartUtilityService.findOrCreateCart(userUuid, transactionManager);

        // Get the cart items and any notification data
        const { cartItems, removedCartItems, priceChanges, quantityChanges } =
          await this.cartItemService.fetchAndUpdateCartItems(transactionManager, {
            cartId: cart.id,
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
    prefix: "cart-count",
    ttl: 3600,
    paramKeys: ["userUuid"],
  })
  async getCartItemCount(userUuid: string): Promise<{ count: number }> {
    try {
      const result = await this.dataSource.manager
        .createQueryBuilder(Cart, "cart")
        .select("cart.totalQuantity", "count")
        .innerJoin("users", "user", "cart.userId = user.id")
        .where("user.uuid = :userUuid", { userUuid })
        .getRawOne();

      return { count: result?.count || 0 };
    } catch (error) {
      this.logger.error(`Failed to get cart count for user ${userUuid}:`, error);
      return { count: 0 };
    }
  }

  async addProductToCart(
    userUuid: string,
    productId: number,
    quantity: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartOperationResponse> {
    // Make sure the quantity doesn't exceed the available limit (10)
    this.commonValidationService.validateQuantity(quantity);

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async transactionalEntityManager => {
      const [user, cart, product] = await Promise.all([
        transactionalEntityManager.findOne(User, { where: { uuid: userUuid } }),
        this.cartUtilityService.findOrCreateCart(userUuid, transactionalEntityManager),
        transactionalEntityManager.findOne(Product, {
          where: { id: productId },
        }),
      ]);

      this.commonValidationService.validateUser(user);

      const quantityChange = await this.cartItemService.addCartItem(
        cart,
        product,
        quantity,
        transactionalEntityManager,
      );

      // Invalidate cache after adding product
      await this.invalidateUserCartCache(userUuid);

      return { success: true, quantityChanges: quantityChange ? [quantityChange] : undefined };
    });
  }

  async updateCartItemQuantity(
    userUuid: string,
    productId: number,
    quantity: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartOperationResponse> {
    this.commonValidationService.validateQuantity(quantity);

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async transactionManager => {
      // Find both cart and cartItem in parallel execution
      const [cart, cartItem] = await Promise.all([
        this.cartUtilityService.findOrCreateCart(userUuid, transactionManager),
        transactionManager.findOne(CartItem, {
          where: {
            cart: { user: { uuid: userUuid } },
            product: { id: productId },
          },
          relations: ["product"],
        }),
      ]);

      // If cartItem exists, update its quantity
      if (cartItem) {
        await this.cartItemService.updateCartItemQuantity(
          cart,
          cartItem,
          quantity,
          transactionManager,
        );
      } else {
        // If cartItem doesn't exist, treat it as a new item addition
        const product = await transactionManager.findOne(Product, {
          where: { id: productId },
        });

        await this.cartItemService.addCartItem(cart, product, quantity, transactionManager);
      }

      // Invalidate cache after updating quantity
      await this.invalidateUserCartCache(userUuid);

      return {
        success: true,
      };
    });
  }

  async removeCartItem(userUuid: string, productId: number): Promise<CartOperationResponse> {
    return this.dataSource.transaction(async transactionalEntityManager => {
      const [cart, cartItemToRemove] = await Promise.all([
        this.cartUtilityService.findOrCreateCart(userUuid, transactionalEntityManager),
        transactionalEntityManager.findOne(CartItem, {
          where: {
            cart: { user: { uuid: userUuid } },
            product: { id: productId },
          },
          relations: ["product"],
        }),
      ]);

      await this.cartItemService.removeCartItem(cart, cartItemToRemove, transactionalEntityManager);

      // Invalidate cache after removing item
      await this.invalidateUserCartCache(userUuid);

      return { success: true };
    });
  }

  async clearCart(userUuid: string): Promise<CartOperationResponse> {
    return this.dataSource.transaction(async transactionalEntityManager => {
      const cart = await this.cartUtilityService.findOrCreateCart(
        userUuid,
        transactionalEntityManager,
      );

      cart.cartTotal = new Decimal(0).toFixed(2);
      cart.totalQuantity = 0;
      cart.cartItems = [];

      await transactionalEntityManager.save(cart);

      // Invalidate cache after clearing cart
      await this.invalidateUserCartCache(userUuid);

      return {
        success: true,
      };
    });
  }

  // Helper method to invalidate user cart cache
  async invalidateUserCartCache(userUuid: string): Promise<void> {
    try {
      const cacheKeys = [
        this.redisService.generateKey("cart-user", { userUuid }),
        this.redisService.generateKey("cart-count", { userUuid }),
      ];

      // Delete all cache keys in parallel
      await Promise.all(cacheKeys.map(key => this.redisService.del(key)));
      this.logger.debug(`Invalidated cache keys for user ${userUuid}`);
    } catch (error) {
      this.logger.error("Failed to invalidate user caches:", error);
    }
  }
}
