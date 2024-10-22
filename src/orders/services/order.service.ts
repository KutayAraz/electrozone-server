import { HttpStatus, Injectable } from "@nestjs/common";
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
import { v4 as uuidv4 } from "uuid";
import { SessionCartService } from "src/carts/services/session-cart.service";
import { CartUtilityService } from "src/carts/services/cart-utility.service";
import { CartItem } from "src/entities/CartItem.entity";
import Decimal from "decimal.js";

@Injectable()
export class OrderService {
  private checkoutSnapshots = [];

  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly cartService: CartService,
    private readonly orderValidationService: OrderValidationService,
    private readonly commonValidationService: CommonValidationService,
    private readonly buyNowCartService: BuyNowCartService,
    private readonly sessionCartService: SessionCartService,
    private readonly cartUtilityService: CartUtilityService,
    private dataSource: DataSource,
  ) { }

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
        throw new AppError(
          ErrorType.INVALID_CHECKOUT_TYPE,
          "Invalid checkout type",
        );
    }

    if (cartResponse.cartItems.length === 0) {
      throw new AppError(ErrorType.EMPTY_CART, "Cart is empty");
    }

    const checkoutSnapshotId = uuidv4();

    // Store snapshot
    this.checkoutSnapshots[checkoutSnapshotId] = {
      id: checkoutSnapshotId,
      userUuid,
      cartItems: cartResponse.cartItems,
      cartTotal: cartResponse.cartTotal,
      totalQuantity: cartResponse.totalQuantity,
      createdAt: new Date(),
      checkoutType,
      sessionId: checkoutType === CheckoutType.SESSION ? sessionId : undefined,
    };

    return {
      checkoutSnapshotId,
      cartData: cartResponse,
    };
  }

  async processOrder(
    userUuid: string,
    checkoutSnapshotId: string,
    idempotencyKey: string,
  ) {
    const existingOrder = await this.dataSource
      .getRepository(Order)
      .findOne({ where: { idempotencyKey } });
    if (existingOrder) {
      return existingOrder.id; // Order already processed
    }

    const snapshot = this.checkoutSnapshots[checkoutSnapshotId];
    if (!snapshot) {
      throw new AppError(
        ErrorType.NO_CHECKOUT_SESSION,
        "No active checkout session found. Please start checkout again.",
      );
    }

    if (snapshot.userUuid !== userUuid) {
      throw new AppError(
        ErrorType.ACCESS_DENIED,
        "You are not authorized to process checkout from this cart.",
        HttpStatus.FORBIDDEN,
      );
    }

    // Check session expiry (15 minutes)
    const sessionAge = Date.now() - snapshot.createdAt.getTime();
    if (sessionAge > 15 * 60 * 1000) {
      delete this.checkoutSnapshots[checkoutSnapshotId];
      throw new AppError(
        ErrorType.CHECKOUT_SESSION_EXPIRED,
        "Checkout session has expired. Please start checkout again.",
      );
    }

    return this.dataSource.transaction(
      "REPEATABLE READ" as IsolationLevel,
      async (transactionManager: EntityManager) => {
        const user = await transactionManager.findOneBy(User, {
          uuid: userUuid,
        });
        this.commonValidationService.validateUser(user);

        // Get user's cart
        const cart = await this.cartUtilityService.findOrCreateCart(
          userUuid,
          transactionManager,
        );

        const order = new Order();
        order.user = user;
        order.idempotencyKey = idempotencyKey;

        let orderTotal: string = new Decimal(0).toFixed(2);

        // Validate items and get products
        const validatedOrderItems = await Promise.all(
          snapshot.cartItems.map(async (cartItem: FormattedCartItem) => {
            const product = await this.orderValidationService.validateOrderItem(
              {
                productId: cartItem.id,
                price: cartItem.price,
                quantity: cartItem.quantity,
              },
              transactionManager,
            );

            // Use the snapshot price for the order
            const orderItemTotal = new Decimal(cartItem.price)
              .times(cartItem.quantity)
              .toFixed(2);
            orderTotal = new Decimal(orderTotal)
              .plus(orderItemTotal)
              .toFixed(2);

            return { validatedOrderItem: cartItem, product, orderItemTotal };
          }),
        );

        order.orderTotal = orderTotal;
        const savedOrder = await transactionManager.save(Order, order);

        // Create and save order items
        const orderItemsEntities = validatedOrderItems.map(
          ({ validatedOrderItem, product, orderItemTotal }) => {
            const orderItem = new OrderItem();
            orderItem.order = savedOrder;
            orderItem.quantity = validatedOrderItem.quantity;
            orderItem.product = product;
            orderItem.productPrice = new Decimal(orderItemTotal).div(
              validatedOrderItem.quantity).toFixed(2);
            orderItem.totalPrice = orderItemTotal;

            // Update product stock and sold count
            product.stock -= validatedOrderItem.quantity;
            product.sold += validatedOrderItem.quantity;

            console.log("order item is ", orderItem);
            return orderItem;
          },
        );

        // Save updated products
        await transactionManager.save(
          Product,
          validatedOrderItems.map(({ product }) => product),
        );
        for (const orderItem of orderItemsEntities) {
          await transactionManager.save(OrderItem, orderItem);
        }
        // Clear the cart based on checkout type
        switch (snapshot.checkoutType) {
          case CheckoutType.NORMAL:
            // Get current cart items that were in the snapshot
            const currentCartItems = await transactionManager.find(CartItem, {
              where: {
                cart: { id: cart.id },
                product: {
                  id: In(snapshot.cartItems.map((product) => product.id)),
                },
              },
              relations: ["product"], // Add this to ensure product relation is loaded
            });

            // First, separate items into those to be removed and those to be updated
            const itemsToRemove: CartItem[] = [];
            const itemsToUpdate: CartItem[] = [];

            for (const currentItem of currentCartItems) {
              const orderedItem = snapshot.cartItems.find(
                (item: CartItem) => item.id === currentItem.product.id,
              );
              if (orderedItem) {
                if (currentItem.quantity <= orderedItem.quantity) {
                  itemsToRemove.push(currentItem);
                } else {
                  currentItem.quantity -= orderedItem.quantity;
                  itemsToUpdate.push(currentItem);
                }
              }
            }

            // Bulk remove items
            if (itemsToRemove.length > 0) {
              await transactionManager.remove(CartItem, itemsToRemove);
            }

            // Bulk update items
            if (itemsToUpdate.length > 0) {
              await transactionManager.save(CartItem, itemsToUpdate);
            }
            break;
          case CheckoutType.SESSION:
            await this.sessionCartService.clearSessionCart(userUuid);
            break;
          case CheckoutType.BUY_NOW:
            break;
        }

        // Clear checkout session
        delete this.checkoutSnapshots[checkoutSnapshotId];

        return savedOrder.id;
      },
    );
  }

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

    const transformedOrderItems = order.orderItems.map(this.transformOrderItem);

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

    return orders.map(this.transformOrder);
  }

  private transformOrderItem(orderItem: OrderItem) {
    return {
      id: orderItem.product.id,
      quantity: orderItem.quantity,
      price: new Decimal(orderItem.quantity)
        .times(orderItem.product.price)
        .toFixed(2),
      productName: orderItem.product.productName,
      brand: orderItem.product.brand,
      thumbnail: orderItem.product.thumbnail,
      category: orderItem.product.subcategory.category.category,
      subcategory: orderItem.product.subcategory.subcategory,
    };
  }

  private transformOrder(order: Order) {
    const orderQuantity = order.orderItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

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
