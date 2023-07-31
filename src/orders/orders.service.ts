import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { Repository } from "typeorm";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { User } from "src/entities/User.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { CreateOrderItemDTO } from "./dtos/create-order-item.dto";
import { Product } from "src/entities/Product.entity";

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) {}

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
    const orderDate = new Date().toLocaleDateString();
    order.orderDate = orderDate;

    const savedOrder = await this.ordersRepo.save(order);

    const orderItemsEntities = await Promise.all(
      orderItems.map(async (item) => {
        const orderItem = new OrderItem();
        orderItem.order = savedOrder;
        orderItem.quantity = item.quantity;
        const product = await this.productsRepo.findOneBy({
          id: item.productId,
        });
        orderItem.product = product;
        orderItem.price = product.price;
        return orderItem;
      }),
    );

    await this.orderItemsRepo.save(orderItemsEntities);

    const result = {
      id: savedOrder.id,
      orderTotal: savedOrder.orderTotal,
      orderDate: savedOrder.orderDate,
      orderItems: orderItemsEntities.map((item) => {
        return {
          product: item.product,
          quantity: item.quantity,
          price: item.price,
        };
      }),
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
      city: user.city,
    };

    return result;
  }

  async getOrderById(userId: number, orderId: number) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ["orders", "orders.orderItems", "orders.orderItems.product"],
    });

    const order = user.orders.find((o) => o.id === orderId);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const orderItems = await this.orderItemsRepo
      .createQueryBuilder("order_item")
      .leftJoinAndSelect("order_item.product", "product")
      .where("order_item.order_id = :orderId", { orderId: orderId })
      .getMany();

    order.orderItems = orderItems;

    return order;
  }

  async getOrdersForUser(userId: number): Promise<Order[]> {
    return this.ordersRepo.find({
      where: {
        user: {
          id: userId,
        },
      },
      relations: ["orderItems", "orderItems.product"],
    });
  }

  async deleteOrder(userId: number, orderId: number) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ["user"],
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (order.user.id !== userId) {
      throw new UnauthorizedException(
        "You did not place this order, therefore can not modify it",
      );
    }

    const currentDate = new Date();
    const orderDate = new Date(order.orderDate);

    if (currentDate.getTime() - orderDate.getTime() > 86400000) {
      throw new UnauthorizedException(
        "Cannot delete an order that is over a day old",
      );
    } else {
      const order = await this.ordersRepo.findOneOrFail({
        where: { id: orderId },
        relations: ["orderItems"],
      });
      const orderItems = order.orderItems;
      await Promise.all(
        orderItems.map(async (orderItem) => {
          await this.orderItemsRepo.delete(orderItem.id);
        }),
      );
      await this.ordersRepo.delete(orderId);
    }

    return {
      message: "Order deleted successfully",
    };
  }
}
