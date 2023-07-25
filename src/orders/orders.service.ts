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
    
  }
}
