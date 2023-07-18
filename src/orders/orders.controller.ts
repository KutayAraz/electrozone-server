import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { User } from "src/entities/User.entity";
import { CurrentUser } from "src/users/decorators/current-user.decorator";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { OrdersService } from "./orders.service";
import { Serialize } from "src/interceptors/serialize.interceptor";
import { OrderDto } from "./dtos/order.dto";
import { ApproveOrderDto } from "./dtos/approve-order.dto";
import { JwtGuard } from "src/users/guards/jwt-auth.guard";

@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtGuard)
  @Serialize(OrderDto)
  createOrder(@Body() body: CreateOrderDto, @CurrentUser() user: User) {
    return this.ordersService.create(body, user);
  }

  @Get()
  @UseGuards(JwtGuard)
  async getOrders(@CurrentUser() user: User) {
    return await this.ordersService.fetch(user);
  }

  @Patch("/:id")
  async approveOrder(@Param("id", ParseIntPipe) id: number, @Body() body: ApproveOrderDto){
    return this.ordersService.changeApproval(id, body.approved)
  }
}