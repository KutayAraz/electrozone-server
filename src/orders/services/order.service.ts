import { Injectable, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Repository, DataSource } from "typeorm";
import { CreateOrderItemDTO } from "../dtos/order-item.dto";
import { OrderValidationService } from "./order-validation.service";
import { ErrorType } from "src/common/errors/error-type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartService } from "src/carts/services/cart.service";

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private readonly cartService: CartService,
    private readonly orderValidationService: OrderValidationService,
    private readonly commonValidationService: CommonValidationService,
    private dataSource: DataSource,
  ) { }

  async createOrder(userUuid: string, orderItems: CreateOrderItemDTO[]) {
    return this.dataSource.transaction(async (transactionManager) => {
      const user = await transactionManager.findOneBy(User, { uuid: userUuid });
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

  async cancelOrder(userUuid: string, orderId: number) {
    return this.dataSource.transaction(async (transactionManager) => {
      const order = await this.orderValidationService.validateUserOrder(userUuid, orderId, this.ordersRepo);

      if (!this.orderValidationService.isOrderCancellable(order.orderDate)) {
        throw new UnauthorizedException(ErrorType.CANCELLATION_PERIOD_ENDED);
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
    const user = await this.usersRepo.findOne({
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
    const orders = await this.ordersRepo.find({
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