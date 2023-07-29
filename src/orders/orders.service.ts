import { Injectable, NotFoundException } from "@nestjs/common";
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

    const total = orderItems.reduce((acc, item) => {
      return acc + item.price * item.quantity;
    }, 0);

    order.orderTotal = total;
    const orderDate = new Date().toLocaleDateString();
    order.orderDate = orderDate;

    const savedOrder = await this.ordersRepo.save(order);

    const orderItemsEntities = await Promise.all(
      orderItems.map(async (item) => {
        const orderItem = new OrderItem();
        orderItem.order = savedOrder;
        orderItem.quantity = item.quantity;
        orderItem.price = item.price;
        orderItem.product = await this.productsRepo.findOneBy({
          id: item.productId,
        });
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
  
  async getOrderById(id: number): Promise<Order> {
    return this.ordersRepo.findOne({
      where: { id },
      relations: ["orderItems", "user"],
    });
  }

  async getOrdersForUser(userId: number): Promise<Order[]> {
    return this.ordersRepo.find({
      where: {
        user: {
          id: userId,
        },
      },
      relations: ["orderItems", "user"],
    });
  }
}
