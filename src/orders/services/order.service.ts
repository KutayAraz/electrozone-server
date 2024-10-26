import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Repository, DataSource, EntityManager } from "typeorm";
import { OrderValidationService } from "./order-validation.service";
import { ErrorType } from "src/common/errors/error-type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartService } from "src/carts/services/cart.service";
import { AppError } from "src/common/errors/app-error";
import { CartResponse } from "src/carts/types/cart-response.type";
import { BuyNowCartService } from "src/carts/services/buy-now-cart.service";
import { CheckoutType } from "../types/checkoutType.enum";
import { OrderItemDTO } from "../dtos/order-item.dto";
import { IsolationLevel } from "typeorm/driver/types/IsolationLevel";
import Decimal from "decimal.js";
import { OrderUtilityService } from "./order-utility.service";

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly cartService: CartService,
    private readonly orderValidationService: OrderValidationService,
    private readonly commonValidationService: CommonValidationService,
    private readonly buyNowCartService: BuyNowCartService,
    private readonly orderUtilityService: OrderUtilityService,
    private dataSource: DataSource,
  ) { }

  /**
   * Process a new order with idempotency check and transaction management
   * Supports both normal checkout from cart and buy-now functionality
   */
  async processOrder(userUuid: string, checkoutType: CheckoutType, orderItemsDto: OrderItemDTO[], idempotencyKey: string) {
    const existingOrder = await this.orderValidationService.validateIdempotency(
      idempotencyKey,
      this.dataSource.getRepository(Order),
    );

    if (existingOrder) {
      return existingOrder.id; // Order has already been processed
    }

    return this.dataSource.transaction("REPEATABLE READ" as IsolationLevel, async (transactionManager: EntityManager) => {
      // Set transaction timeout
      await transactionManager.query('SET LOCAL statement_timeout = 30000'); // 30 seconds timeout

      const user = await transactionManager.findOneBy(User, { uuid: userUuid });
      this.commonValidationService.validateUser(user);

      // Get cart items based on checkout type
      let latestCartResponse: CartResponse;
      if (checkoutType === CheckoutType.NORMAL) {
        latestCartResponse = await this.cartService.getUserCart(userUuid);
      } else if (checkoutType === CheckoutType.BUY_NOW) {
        latestCartResponse = await this.buyNowCartService.getBuyNowCart(userUuid);
      }

      const validatedOrderItems = await this.orderValidationService.validateOrderWithCart(
        latestCartResponse.cartItems,
        orderItemsDto,
        transactionManager,
      );

      // Create and save the order with calculated total
      const order = new Order();
      order.user = user;
      order.idempotencyKey = idempotencyKey;
      order.orderTotal = validatedOrderItems.reduce(
        (total, { orderItemTotal }) => new Decimal(total).plus(orderItemTotal).toFixed(2),
        "0.00",
      );

      const savedOrder = await transactionManager.save(Order, order);

      // Create order items and update product inventory
      const orderItemsEntities = validatedOrderItems.map(({ orderItem, product }) => {
        const orderItemEntity = new OrderItem();
        orderItemEntity.order = savedOrder;
        orderItemEntity.quantity = orderItem.quantity;
        orderItemEntity.product = product;
        orderItemEntity.productPrice = product.price;

        // Update product stock and sold count
        product.stock -= orderItem.quantity;
        product.sold += orderItem.quantity;

        return orderItem;
      });

      // Batch save products and order items
      await transactionManager.save(Product, validatedOrderItems.map(({ product }) => product));
      await transactionManager.save(OrderItem, orderItemsEntities);

      // Clear the cart if CheckoutType is NORMAL
      if (checkoutType === CheckoutType.NORMAL) {
        await this.cartService.clearCart(userUuid);
      }

      return savedOrder.id;
    });
  }

  /**
   * Cancel an order and restore product inventory
   * Only allowed within the cancellation period
   */
  async cancelOrder(userUuid: string, orderId: number) {
    return this.dataSource.transaction(async (transactionManager) => {
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

      // Restore product inventory
      await Promise.all(
        order.orderItems.map(async (orderItem) => {
          const product = await transactionManager.findOneBy(Product, {
            id: orderItem.product.id,
          });
          product.sold -= orderItem.quantity;
          product.stock += orderItem.quantity;
          await transactionManager.save(Product, product);
        }),
      );

      await transactionManager.remove(order);
    });
  }

  // Get paginated list of orders for a user
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

    const order = user.orders.find((o) => o.id === orderId);
    this.orderValidationService.validateOrder(order);

    const transformedOrderItems = order.orderItems.map(this.orderUtilityService.transformOrderItem);

    const isCancellable = this.orderValidationService.isOrderCancellable(
      order.orderDate,
    );

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
}
