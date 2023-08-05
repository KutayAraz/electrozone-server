import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { OrdersService } from "./orders.service";
import { AtGuard } from "src/common/guards";
import {
  GetCurrentUserId,
} from "src/common/decorators";

@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @UseGuards(AtGuard)
  @Post()
  createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @GetCurrentUserId() id: number,
  ) {
    return this.ordersService.createOrder(id, createOrderDto.orderItems);
  }

  @UseGuards(AtGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @Get("user")
  async getOrdersForUser(@GetCurrentUserId() id: number) {
    return this.ordersService.getOrdersForUser(id);
  }

  @UseGuards(AtGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @Get("user/:orderId")
  async getOrder(
    @GetCurrentUserId() userId: number,
    @Param("orderId") orderId: string,
  ) {
    return await this.ordersService.getOrderById(userId, parseInt(orderId));
  }

  @UseGuards(AtGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @Delete("user/:orderId")
  async deleteOrder(
    @GetCurrentUserId() id: number,
    @Param("orderId") orderId: string,
  ) {
    return this.ordersService.deleteOrder(id, parseInt(orderId));
  }
}
