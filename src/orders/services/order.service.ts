import { Injectable, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Repository, DataSource, In } from "typeorm";
import { CreateOrderItemDTO } from "../dtos/order-item.dto";
import { OrderValidationService } from "./order-validation.service";
import { ErrorType } from "src/common/errors/error-type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartService } from "src/carts/services/cart.service";
import { AppError } from "src/common/errors/app-error";
import { CheckoutSessionMap } from "../types/checkout-session-map.type";
import { CartResponse } from "src/carts/types/cart-response.type";
import { CartItem } from "src/entities/CartItem.entity";
import { Cart } from "src/entities/Cart.entity";
import { CartUtilityService } from "src/carts/services/cart-utility.service";

@Injectable()
export class OrderService {
  private checkoutSessions: CheckoutSessionMap = {};

  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly cartService: CartService,
    private readonly orderValidationService: OrderValidationService,
    private readonly commonValidationService: CommonValidationService,
    private readonly cartUtilityService: CartUtilityService,
    private dataSource: DataSource,
  ) { }

  async initiateCheckout(userUuid: string): Promise<CartResponse> {
    const cartResponse = await this.cartService.getUserCart(userUuid);

    if (cartResponse.cartItems.length === 0) {
      throw new AppError(ErrorType.EMPTY_CART, 'Cart is empty');
    }

    // Check if there's an existing session and clean it up
    if (this.checkoutSessions[userUuid]) {
      delete this.checkoutSessions[userUuid];
    }

    // Store snapshot
    this.checkoutSessions[userUuid] = {
      cartItems: cartResponse.cartItems,
      cartTotal: cartResponse.cartTotal,
      totalQuantity: cartResponse.totalQuantity,
      createdAt: new Date(),
    };

    return cartResponse;
  }

  async processOrder(userUuid: string) {
    const snapshot = this.checkoutSessions[userUuid];
    if (!snapshot) {
      throw new AppError(
        ErrorType.NO_CHECKOUT_SESSION,
        'No active checkout session found. Please start checkout again.'
      );
    }

    // Check session expiry (60 minutes)
    const sessionAge = Date.now() - snapshot.createdAt.getTime();
    if (sessionAge > 60 * 60 * 1000) {
      delete this.checkoutSessions[userUuid];
      throw new AppError(
        ErrorType.CHECKOUT_SESSION_EXPIRED,
        'Checkout session has expired. Please start checkout again.'
      );
    }

    return this.dataSource.transaction(async (transactionManager) => {
      const user = await transactionManager.findOneBy(User, { uuid: userUuid });
      this.commonValidationService.validateUser(user);

      // Get user's cart
      const cart = await this.cartUtilityService.findOrCreateCart(userUuid, transactionManager);

      const order = new Order();
      order.user = user;

      const snapshot = this.checkoutSessions[userUuid];

      console.log("snapshot is ", snapshot)

      // Validate items and get products
      const validatedOrderItems = await Promise.all(
        snapshot.cartItems.map(async (cartItem) => {
          const product = await this.orderValidationService.validateOrderItem(
            {
              productId: cartItem.id,
              price: cartItem.price,
              quantity: cartItem.quantity
            },
            transactionManager
          );
          return { cartItem, product };
        })
      );

      order.orderTotal = snapshot.cartTotal;
      const savedOrder = await transactionManager.save(Order, order);

      // Create and save order items
      const orderItemsEntities = validatedOrderItems.map(({ cartItem, product }) => {
        const orderItem = new OrderItem();
        orderItem.order = savedOrder;
        orderItem.quantity = cartItem.quantity;
        orderItem.product = product;
        orderItem.price = product.price;

        // Update product stock and sold count
        product.stock -= cartItem.quantity;
        product.sold += cartItem.quantity;

        return orderItem;
      });

      // Save updated products
      await transactionManager.save(Product, validatedOrderItems.map(({ product }) => product));
      await transactionManager.save(OrderItem, orderItemsEntities);

      // Get current cart items that were in the snapshot
      const currentCartItems = await transactionManager.find(CartItem, {
        where: {
          cart: { id: cart.id },
          product: {
            id: In(snapshot.cartItems.map(item => item.id))
          }
        },
        relations: ['product'] // Add this to ensure product relation is loaded
      });

      // First, separate items into those to be removed and those to be updated
      const itemsToRemove: CartItem[] = [];
      const itemsToUpdate: CartItem[] = [];

      for (const currentItem of currentCartItems) {
        const orderedItem = snapshot.cartItems.find(item => item.id === currentItem.product.id);
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
      // Clear checkout session
      delete this.checkoutSessions[userUuid];

      return savedOrder.id;
    });
  }

  async createOrder(userUuid: string, orderItems: CreateOrderItemDTO[]) {
    return this.dataSource.transaction(async (transactionManager) => {
      const user = await transactionManager.findOneBy(User, { uuid: userUuid });
      this.commonValidationService.validateUser(user);

      const order = new Order();
      order.user = user;

      let total = 0;
      const validatedOrderItems = await Promise.all(
        orderItems.map(async (item) => {
          const product = await this.orderValidationService.validateOrderItem(item, transactionManager);
          total += product.price * item.quantity;
          return { item, product };
        })
      );

      order.orderTotal = total;
      const savedOrder = await transactionManager.save(Order, order);

      const orderItemsEntities = validatedOrderItems.map(({ item, product }) => {
        const orderItem = new OrderItem();
        orderItem.order = savedOrder;
        orderItem.quantity = item.quantity;
        orderItem.product = product;
        orderItem.price = product.price;

        product.stock -= item.quantity;
        product.sold += item.quantity;

        return orderItem;
      });

      await transactionManager.save(Product, validatedOrderItems.map(({ product }) => product));
      await transactionManager.save(OrderItem, orderItemsEntities);
      await this.cartService.clearCart(userUuid);

      return savedOrder.id;
    });
  }

  async createBuyNowOrder(userUuid: string, sessionId: string) {

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