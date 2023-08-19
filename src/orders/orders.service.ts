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
        await this.productsRepo.save(product);
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

  async deleteOrder(userId: number, orderId: number) {
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
      relations: ["orders", "orders.orderItems", "orders.orderItems.product"],
    });

    const order = user.orders.find((o) => o.id === orderId);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const orderItems = await this.orderItemsRepo
      .createQueryBuilder("order_item")
      .leftJoinAndSelect("order_item.product", "product")
      .where("order_item.orderId = :orderId", { orderId })
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
}
