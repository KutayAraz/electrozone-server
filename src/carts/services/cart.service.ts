import { Injectable, Logger } from "@nestjs/common";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { DataSource, EntityManager } from "typeorm";
import { CartItemService } from "./cart-item.service";
import { CartResponse } from "../types/cart-response.type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartUtilityService } from "./cart-utility.service";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { QuantityChange } from "../types/quantity-change.type";
import Decimal from "decimal.js";
import { CacheResult } from "src/redis/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name)

  constructor(
    private readonly cartItemService: CartItemService,
    private readonly cartUtilityService: CartUtilityService,
    private readonly commonValidationService: CommonValidationService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService
  ) { }

  @CacheResult({
    prefix: 'cart-user',
    ttl: 3600,
    paramKeys: ['userUuid']
  })
  async getUserCart(
    userUuid: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartResponse> {
    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async (transactionManager) => {
      let cart = await this.cartUtilityService.findOrCreateCart(
        userUuid,
        transactionManager,
      );

      // Update the cart items and notify user of any changes to product price or stock change
      const { cartItems, removedCartItems, priceChanges, quantityChanges } =
        await this.cartItemService.fetchAndUpdateCartItems(transactionManager, {
          cartId: cart.id,
        });

      // Recalculate cart total and quantity
      const cartTotal = cartItems
        .reduce((total, product) => {
          return total.plus(new Decimal(product.amount));
        }, new Decimal(0))
        .toFixed(2);

      const totalQuantity = cartItems.reduce(
        (total, product) => total + product.quantity,
        0,
      );

      // Update cart in database
      await transactionManager.update(Cart, cart.id, {
        cartTotal,
        totalQuantity,
      });

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

  async addProductToCart(
    userUuid: string,
    productId: number,
    quantity: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<QuantityChange> {
    // Make sure the quantity doesn't exceed the available limit (10)
    this.commonValidationService.validateQuantity(quantity);

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async (transactionalEntityManager) => {
      const [user, cart, product] = await Promise.all([
        transactionalEntityManager.findOne(User, { where: { uuid: userUuid } }),
        this.cartUtilityService.findOrCreateCart(
          userUuid,
          transactionalEntityManager,
        ),
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

      return quantityChange;
    });
  }

  async updateCartItemQuantity(
    userUuid: string,
    productId: number,
    quantity: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<CartResponse> {
    this.commonValidationService.validateQuantity(quantity);

    const manager = transactionalEntityManager || this.dataSource.manager;

    return manager.transaction(async (transactionManager) => {
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
        await this.cartItemService.addCartItem(
          cart,
          product,
          quantity,
          transactionManager,
        );
      }

      // Invalidate cache after updating quantity
      await this.invalidateUserCartCache(userUuid);

      // Return updated cart information
      return await this.getUserCart(userUuid, transactionManager);
    });
  }

  async removeCartItem(
    userUuid: string,
    productId: number,
  ): Promise<CartResponse> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const [cart, cartItemToRemove] = await Promise.all([
        this.cartUtilityService.findOrCreateCart(
          userUuid,
          transactionalEntityManager,
        ),
        transactionalEntityManager.findOne(CartItem, {
          where: {
            cart: { user: { uuid: userUuid } },
            product: { id: productId },
          },
        }),
      ]);

      await this.cartItemService.removeCartItem(
        cart,
        cartItemToRemove,
        transactionalEntityManager,
      );

      // Invalidate cache after removing item
      await this.invalidateUserCartCache(userUuid);

      return this.getUserCart(userUuid, transactionalEntityManager);
    });
  }

  async clearCart(userUuid: string): Promise<CartResponse> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const cart = await this.cartUtilityService.findOrCreateCart(
        userUuid,
        transactionalEntityManager,
      );

      cart.cartTotal = new Decimal(0).toFixed(2);;
      cart.totalQuantity = 0;
      cart.cartItems = [];

      await transactionalEntityManager.save(cart);

      // Invalidate cache after clearing cart
      await this.invalidateUserCartCache(userUuid);

      return {
        cartTotal: cart.cartTotal,
        totalQuantity: cart.totalQuantity,
        cartItems: [],
      };
    });
  }

  // Helper method to invalidate user cart cache
  private async invalidateUserCartCache(userUuid: string): Promise<void> {
    try {
      const cacheKey = this.redisService.generateKey('cart-user', { userUuid });
      await this.redisService.del(cacheKey);
      this.logger.debug(`Invalidated cache keys for user ${userUuid}`);
    } catch (error) {
      this.logger.error('Failed to invalidate user caches:', error);
    }
  }
}
