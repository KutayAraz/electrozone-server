import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { Repository } from "typeorm";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { User } from "src/entities/User.entity";

@Injectable()
export class OrdersService {
  constructor(@InjectRepository(Order) private ordersRepo: Repository<Order>) {}

  create(orderInfo: CreateOrderDto, user: User) {
    const order = this.ordersRepo.create(orderInfo);
    order.user = user;

    return this.ordersRepo.save(order);
  }

  async fetch(user: User) {
    const orders = await this.ordersRepo.find({
      where: {
        user,
      },
    });

    return orders;
  }

  async changeApproval(id: number, approved: boolean) {
    const order = await this.ordersRepo.findOne({
      where: {
        id,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    order.approved = approved;
    return this.ordersRepo.save(order);
  }
}
