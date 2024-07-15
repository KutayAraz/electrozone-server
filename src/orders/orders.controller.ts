import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { OrdersService } from "./orders.service";
import { AtGuard } from "src/common/guards";
import {
  GetCurrentUserId,
} from "src/common/decorators";
import { SkipThrottle } from "@nestjs/throttler";

@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) { }

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
  @SkipThrottle()
  @Get("user")
  async getOrdersForUser(
    @GetCurrentUserId() id: number,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,) {
    return this.ordersService.getOrdersForUser(id, skip, take);
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
  async cancelOrder(
    @GetCurrentUserId() id: number,
    @Param("orderId") orderId: string,

  ) {
    return this.ordersService.cancelOrder(id, parseInt(orderId));
  }
}
