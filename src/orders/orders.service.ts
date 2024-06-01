import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { Repository } from "typeorm";
import { User } from "src/entities/User.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { CreateOrderItemDTO } from "./dtos/create-order-item.dto";
import { Product } from "src/entities/Product.entity";
import { CartsService } from "src/carts/carts.service";

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    private readonly cartsService: CartsService,
  ) { }

  async createOrder(userId: number, orderItems: CreateOrderItemDTO[]) {
    const user = await this.usersRepo.findOneBy({ id: userId });

    const order = new Order();
    order.user = user;

    let total = 0;
    await Promise.all(
      orderItems.map(async (item) => {
        const product = await this.productsRepo.findOneBy({
          id: item.productId,
        });
        total += product.price * item.quantity;
      }),
    );

    order.orderTotal = total;

    const savedOrder = await this.ordersRepo.save(order);

    const orderItemsEntities = await Promise.all(
      orderItems.map(async (item) => {
        const orderItem = new OrderItem();
        orderItem.order = savedOrder;
        orderItem.quantity = item.quantity;
        const product = await this.productsRepo.findOneBy({
          id: item.productId,
        });
        product.sold += orderItem.quantity;
        product.stock -= orderItem.quantity;
        await this.productsRepo.save(product);
        orderItem.product = product;
        orderItem.price = product.price;
        return orderItem;
      }),
    );

    await this.orderItemsRepo.save(orderItemsEntities);
    await this.cartsService.clearCart(userId);

    return savedOrder.id;
  }

  async isOrderCancellable(userId: number, orderId: number) {
    const order = await this.ordersRepo.findOneOrFail({
      where: { id: orderId },
      relations: ["user", "orderItems"],
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (order.user.id !== userId) {
      throw new UnauthorizedException(
        "You did not place this order, therefore can not modify it",
      );
    }

    if (new Date().getTime() - order.orderDate.getTime() > 86400000) {
      return false;
    } else {
      return true;
    }
  }

  async cancelOrder(userId: number, orderId: number) {
    const order = await this.ordersRepo.findOneOrFail({
      where: { id: orderId },
      relations: ["user", "orderItems"],
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (order.user.id !== userId) {
      throw new UnauthorizedException(
        "You did not place this order, therefore can not modify it",
      );
    }

    if (new Date().getTime() - order.orderDate.getTime() > 86400000) {
      throw new UnauthorizedException(
        "Cannot delete an order that is over a day old",
      );
    } else {
      await Promise.all(
        order.orderItems.map(async (orderItem) => {
          const order_item = await this.orderItemsRepo.findOneOrFail({
            where: { id: orderItem.id },
            relations: ["product"],
          });
          const product = await this.productsRepo.findOneByOrFail({
            id: order_item.product.id,
          });
          product.sold -= orderItem.quantity;
          product.stock += orderItem.quantity;
          await this.productsRepo.save(product);
          await this.orderItemsRepo.delete(orderItem.id);
        }),
      );
      await this.ordersRepo.delete(orderId);
    }

    return {
      message: "Order deleted successfully",
    };
  }

  async getOrderById(userId: number, orderId: number) {
    const user = await this.usersRepo.findOneOrFail({
      where: { id: userId },
      relations: [
        "orders",
        "orders.orderItems",
        "orders.orderItems.product",
        "orders.orderItems.product.subcategory",
        "orders.orderItems.product.subcategory.category",
      ],
    });

    const order = user.orders.find((o) => o.id === orderId);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const transformedOrderItems = order.orderItems.map((orderItem) => ({
      id: orderItem.product.id,
      quantity: orderItem.quantity,
      price: orderItem.quantity * orderItem.product.price,
      productName: orderItem.product.productName,
      brand: orderItem.product.brand,
      thumbnail: orderItem.product.thumbnail,
      category: orderItem.product.subcategory.category.category,
      subcategory: orderItem.product.subcategory.subcategory,
    }));

    const isCancellable = await this.isOrderCancellable(userId, orderId);

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

  async getOrdersForUser(userId: number, skip: number, take: number) {
    const orders = await this.ordersRepo.find({
      where: { user: { id: userId } },
      relations: [
        "user",
        "orderItems",
        "orderItems.product",
        "orderItems.product.subcategory",
        "orderItems.product.subcategory.category",
      ],
      order: {
        orderDate: "DESC",
      },
      skip, // Offset: Number of rows to skip
      take  // Limit: Maximum number of rows to return
    });

    return orders.map((order) => {
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
    });
}

}
