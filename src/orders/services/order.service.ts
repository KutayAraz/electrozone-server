import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { BuyNowCartService } from "src/carts/services/buy-now-cart.service";
import { CartUtilityService } from "src/carts/services/cart-utility.service";
import { CartService } from "src/carts/services/cart.service";
import { SessionCartService } from "src/carts/services/session-cart.service";
import { CartResponse } from "src/carts/types/cart-response.type";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.entity";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { CacheResult } from "src/redis/cache-result.decorator";
import { DataSource, EntityManager, Repository } from "typeorm";
import { IsolationLevel } from "typeorm/driver/types/IsolationLevel";
import { v4 as uuidv4 } from "uuid";
import { CheckoutSnapshot } from "../types/checkout-snapshot.type";
import { CheckoutType } from "../types/checkoutType.enum";
import { OrderUtilityService } from "./order-utility.service";
import { OrderValidationService } from "./order-validation.service";

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  private checkoutSnapshots = new Map<string, CheckoutSnapshot>();

  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly cartService: CartService,
    private readonly orderValidationService: OrderValidationService,
    private readonly commonValidationService: CommonValidationService,
    private readonly buyNowCartService: BuyNowCartService,
    private readonly sessionCartService: SessionCartService,
    private readonly cartUtilityService: CartUtilityService,
    private readonly orderUtilityService: OrderUtilityService,
    private dataSource: DataSource,
  ) {}

  /**
   * Initiates the checkout process by creating a snapshot of the current cart state
   * This prevents race conditions and ensures price/stock consistency during checkout
   */
  async initiateCheckout(
    userUuid: string,
    checkoutType: CheckoutType,
    sessionId?: string,
  ): Promise<{ checkoutSnapshotId: string; cartData: CartResponse }> {
    let cartResponse: CartResponse | PromiseLike<CartResponse>;

    switch (checkoutType) {
      case CheckoutType.NORMAL:
        cartResponse = await this.cartService.getUserCart(userUuid);
        break;
      case CheckoutType.SESSION:
        cartResponse = await this.sessionCartService.getSessionCart(sessionId);
        break;
      case CheckoutType.BUY_NOW:
        cartResponse = await this.buyNowCartService.getBuyNowCart(userUuid);
        break;
      default:
        throw new AppError(ErrorType.INVALID_CHECKOUT_TYPE, "Invalid checkout type");
    }

    if (cartResponse.cartItems.length === 0) {
      throw new AppError(ErrorType.EMPTY_CART, "Cart is empty");
    }

    const checkoutSnapshotId = uuidv4();

    // Store cart snapshot with metadata
    // This snapshot will be used to verify cart consistency during order processing
    this.checkoutSnapshots.set(checkoutSnapshotId, {
      id: checkoutSnapshotId,
      userUuid,
      cartItems: cartResponse.cartItems,
      cartTotal: cartResponse.cartTotal,
      totalQuantity: cartResponse.totalQuantity,
      createdAt: new Date(),
      checkoutType,
      sessionId: checkoutType === CheckoutType.SESSION ? sessionId : undefined,
    });

    return {
      checkoutSnapshotId,
      cartData: cartResponse,
    };
  }

  async processOrder(userUuid: string, checkoutSnapshotId: string, idempotencyKey: string) {
    // Check if this order was already processed using idempotency key

    const existingOrder = await this.orderValidationService.validateIdempotency(
      idempotencyKey,
      this.dataSource.getRepository(Order),
    );

    if (existingOrder) {
      return existingOrder.id; // Order has already been processed
    }

    // Retrieve and validate checkout snapshot
    const snapshot = this.checkoutSnapshots.get(checkoutSnapshotId);

    console.log("snapshots are", this.checkoutSnapshots);
    this.orderValidationService.validateCheckoutSession(snapshot, userUuid);

    // Process order in a transaction with REPEATABLE READ isolation
    // This prevents phantom reads and ensures consistency during the entire order process
    return this.dataSource.transaction(
      "REPEATABLE READ" as IsolationLevel,
      async (transactionManager: EntityManager) => {
        const user = await transactionManager.findOneBy(User, {
          uuid: userUuid,
        });
        this.commonValidationService.validateUser(user);

        // Get or create user's cart for cleanup later
        const cart = await this.cartUtilityService.findOrCreateCart(userUuid, transactionManager);

        // Create order and order items, update product stock
        const { savedOrder, updatedProducts, orderItemsEntities } =
          await this.orderUtilityService.createOrderWithItems(
            user,
            idempotencyKey,
            snapshot.cartItems,
            transactionManager,
          );

        await this.orderUtilityService.handleLowStockProducts(updatedProducts);

        for (const orderItem of orderItemsEntities) {
          await transactionManager.save(OrderItem, orderItem);
        }

        // Clear the cart based on checkout type
        switch (snapshot.checkoutType) {
          case CheckoutType.NORMAL:
            await this.orderUtilityService.handleNormalCartCleanup(
              cart,
              snapshot.cartItems,
              transactionManager,
            );
            break;
          case CheckoutType.SESSION:
            await this.sessionCartService.clearSessionCart(userUuid);
            break;
          case CheckoutType.BUY_NOW:
            break;
        }

        // Clear checkout session
        this.checkoutSnapshots.delete(checkoutSnapshotId);

        return savedOrder.id;
      },
    );
  }

  async cancelOrder(userUuid: string, orderId: number) {
    return this.dataSource.transaction(async transactionManager => {
      const order = await this.orderValidationService.validateUserOrder(
        userUuid,
        orderId,
        this.orderRepository,
      );

      if (!this.orderValidationService.isOrderCancellable(order.orderDate)) {
        throw new AppError(
          ErrorType.CANCELLATION_PERIOD_ENDED,
          "Cancellation period has ended for this order",
        );
      }

      await Promise.all(
        order.orderItems.map(async orderItem => {
          const product = orderItem.product;

          if (!product) {
            console.warn(
              `Product not found for orderItem ${orderItem.id}. Skipping inventory update.`,
            );
            return; // Skip this item and continue with others
          }

          // Update product inventory and sales count
          product.sold -= orderItem.quantity;
          product.stock += orderItem.quantity;

          try {
            await transactionManager.save(Product, product);
          } catch (error) {
            console.error(`Failed to update product ${product.id} inventory: ${error.message}`);
          }
        }),
      );

      await transactionManager.remove(order);

      return { success: true, message: "Order cancelled successfully" };
    });
  }

  @CacheResult({
    prefix: "order-id",
    ttl: 1800,
    paramKeys: ["userUuid", "orderId"],
  })
  async getOrderById(userUuid: string, orderId: number) {
    const user = await this.userRepository.findOne({
      where: { uuid: userUuid },
      relations: [
        "orders",
        "orders.orderItems",
        "orders.orderItems.product",
        "orders.orderItems.product.subcategory",
        "orders.orderItems.product.subcategory.category",
      ],
    });

    this.commonValidationService.validateUser(user);

    const order = user.orders.find(o => o.id === orderId);
    this.orderValidationService.validateOrder(order);

    const transformedOrderItems = order.orderItems.map(this.orderUtilityService.transformOrderItem);

    const isCancellable = this.orderValidationService.isOrderCancellable(order.orderDate);

    return {
      id: order.id,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        address: user.address,
        city: user.city,
      },
      orderTotal: order.orderTotal,
      orderDate: order.orderDate,
      orderItems: transformedOrderItems,
      isCancellable,
    };
  }

  @CacheResult({
    prefix: "order-user",
    ttl: 86400,
    paramKeys: ["userUuid", "skip", "take"],
  })
  async getOrdersForUser(userUuid: string, skip: number, take: number) {
    const orders = await this.orderRepository.find({
      where: { user: { uuid: userUuid } },
      relations: [
        "user",
        "orderItems",
        "orderItems.product",
        "orderItems.product.subcategory",
        "orderItems.product.subcategory.category",
      ],
      order: { orderDate: "DESC" },
      skip, // Offset: Number of rows to skip
      take, // Limit: Maximum number of rows to return
    });

    return orders.map(this.orderUtilityService.transformOrder);
  }

  @Cron(CronExpression.EVERY_HOUR)
  cleanupAgedSnapshots() {
    const now = new Date();
    const maxAgeMs = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    let removedCount = 0;

    for (const id in this.checkoutSnapshots) {
      const snapshot = this.checkoutSnapshots.get(id);
      const ageMs = now.getTime() - snapshot.createdAt.getTime();

      if (ageMs > maxAgeMs) {
        this.checkoutSnapshots.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`Removed ${removedCount} expired checkout snapshots (older than 3 hours)`);
    }
  }
}
