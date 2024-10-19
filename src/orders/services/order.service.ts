import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Repository, DataSource, In, EntityManager } from "typeorm";
import { OrderValidationService } from "./order-validation.service";
import { ErrorType } from "src/common/errors/error-type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartService } from "src/carts/services/cart.service";
import { AppError } from "src/common/errors/app-error";
import { CartResponse } from "src/carts/types/cart-response.type";
import { BuyNowCartService } from "src/carts/services/buy-now-cart.service";
import { CheckoutType } from "../types/checkoutType.enum";
import { FormattedCartItem } from "src/carts/types/formatted-cart-product.type";
import { OrderItemDTO } from "../dtos/order-item.dto";
import { IsolationLevel } from "typeorm/driver/types/IsolationLevel";

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly cartService: CartService,
    private readonly orderValidationService: OrderValidationService,
    private readonly commonValidationService: CommonValidationService,
    private readonly buyNowCartService: BuyNowCartService,
    private dataSource: DataSource,
  ) { }

  private compareCartItems(cartItems: FormattedCartItem[], orderItems: OrderItemDTO[]): boolean {
    if (cartItems.length !== orderItems.length) return false;

    return cartItems.every(cartItem => {
      const orderItem = orderItems.find(item => item.productId === cartItem.id);
      return orderItem
        && orderItem.quantity === cartItem.quantity
        && Math.abs(orderItem.price - cartItem.price) < 0.01; // Allow for small floating point discrepancies
    });
  }

  async processOrder(userUuid: string, checkoutType: CheckoutType, orderItemsDto: OrderItemDTO[], idempotencyKey: string) {
    const existingOrder = await this.dataSource.getRepository(Order).findOne({ where: { idempotencyKey } });
    if (existingOrder) {
      return existingOrder.id; // Order already processed
    }

    return this.dataSource.transaction("REPEATABLE READ" as IsolationLevel, async (transactionManager: EntityManager) => {
      // Set transaction timeout
      await transactionManager.query('SET LOCAL statement_timeout = 30000'); // 30 seconds timeout

      const user = await transactionManager.findOneBy(User, { uuid: userUuid });
      this.commonValidationService.validateUser(user);

      let latestCartResponse: CartResponse;
      if (CheckoutType.NORMAL) {
        latestCartResponse = await this.cartService.getUserCart(userUuid);
      } else if (CheckoutType.BUY_NOW) {
        latestCartResponse = await this.buyNowCartService.getBuyNowCart(userUuid);
      } else {
        throw new AppError(ErrorType.INVALID_CHECKOUT_TYPE, "Invalid checkout. Please try again.")
      }

      // Compare the latest cart with the snapshot
      if (!this.compareCartItems(latestCartResponse.cartItems, orderItemsDto)) {
        throw new AppError(
          ErrorType.CART_CHANGED,
          'Your cart has changed since checkout was initiated. Please review your cart and try again.'
        );
      }

      const order = new Order();
      order.user = user;
      order.idempotencyKey = idempotencyKey;
      let orderTotal: number = 0;

      // Validate items and get products
      const validatedOrderItems = await Promise.all(
        orderItemsDto.map(async (orderItemDto) => {
          const product = await this.orderValidationService.validateOrderItem(
            {
              productId: orderItemDto.productId,
              price: orderItemDto.price,
              quantity: orderItemDto.quantity
            },
            transactionManager
          );
          orderTotal += product.price * orderItemDto.quantity
          return { validatedOrderItem: orderItemDto, product };
        })
      );

      order.orderTotal = orderTotal

      const savedOrder = await transactionManager.save(Order, order);

      // Create and save order items
      const orderItemsEntities = validatedOrderItems.map(({ validatedOrderItem, product }) => {
        const orderItem = new OrderItem();
        orderItem.order = savedOrder;
        orderItem.quantity = validatedOrderItem.quantity;
        orderItem.product = product;
        orderItem.price = product.price;

        // Update product stock and sold count
        product.stock -= validatedOrderItem.quantity;
        product.sold += validatedOrderItem.quantity;

        return orderItem;
      });

      // Save updated products
      await transactionManager.save(Product, validatedOrderItems.map(({ product }) => product));
      await transactionManager.save(OrderItem, orderItemsEntities);

      // Clear the cart based on checkout type
      switch (checkoutType) {
        case CheckoutType.NORMAL:
          await this.cartService.clearCart(userUuid);
          break;
        case CheckoutType.BUY_NOW:
          // No need to clear anything for buy now
          break;
      }

      return savedOrder.id;
    });
  }

  async cancelOrder(userUuid: string, orderId: number) {
    return this.dataSource.transaction(async (transactionManager) => {
      const order = await this.orderValidationService.validateUserOrder(userUuid, orderId, this.orderRepository);

      if (!this.orderValidationService.isOrderCancellable(order.orderDate)) {
        throw new AppError(ErrorType.CANCELLATION_PERIOD_ENDED, "Cancellation period has ended for this order");
      }

      await Promise.all(
        order.orderItems.map(async (orderItem) => {
          const product = await transactionManager.findOneBy(Product, { id: orderItem.product.id });
          product.sold -= orderItem.quantity;
          product.stock += orderItem.quantity;
          await transactionManager.save(Product, product);
        })
      );

      await transactionManager.remove(order);
    });
  }

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

    this.commonValidationService.validateUser(user)

    const order = user.orders.find((o) => o.id === orderId);
    this.orderValidationService.validateOrder(order)

    const transformedOrderItems = order.orderItems.map(this.transformOrderItem);

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
      skip,  // Offset: Number of rows to skip
      take   // Limit: Maximum number of rows to return
    });

    return orders.map(this.transformOrder);
  }

  private transformOrderItem(orderItem: OrderItem) {
    return {
      id: orderItem.product.id,
      quantity: orderItem.quantity,
      price: orderItem.quantity * orderItem.product.price,
      productName: orderItem.product.productName,
      brand: orderItem.product.brand,
      thumbnail: orderItem.product.thumbnail,
      category: orderItem.product.subcategory.category.category,
      subcategory: orderItem.product.subcategory.subcategory,
    };
  }

  private transformOrder(order: Order) {
    const orderQuantity = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);

    const transformedOrderItems = order.orderItems.map((item) => ({
      productId: item.product.id,
      productName: item.product.productName,
      thumbnail: item.product.thumbnail,
      subcategory: item.product.subcategory.subcategory,
      category: item.product.subcategory.category.category,
    }));

    return {
      orderId: order.id,
      orderTotal: order.orderTotal,
      orderDate: order.orderDate,
      orderQuantity,
      user: {
        firstName: order.user.firstName,
        lastName: order.user.lastName,
      },
      orderItems: transformedOrderItems,
    };
  }
}