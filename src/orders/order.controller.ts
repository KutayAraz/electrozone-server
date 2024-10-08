import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { SkipThrottle } from "@nestjs/throttler";
import { OrderService } from "./services/order.service";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";

@Controller('order')
@UseInterceptors(ClassSerializerInterceptor)
export class OrderController {
  constructor(private orderService: OrderService) { }

  @Get("/confirm")
  createOrder(
    @UserUuid() userUuid: string,
  ) {
    return this.orderService.processOrder(userUuid);
  }

  @Get()
  initiateOrder(@UserUuid() userUuid: string,) {
    return this.orderService.initiateCheckout(userUuid)
  }

  @Get()
  @SkipThrottle()
  getOrdersForUser(
    @UserUuid() userUuid: string,
    @Query('skip', ParseIntPipe) skip: number = 0,
    @Query('limit', ParseIntPipe) take: number = 10,
  ) {
    return this.orderService.getOrdersForUser(userUuid, skip, take);
  }

  @Get(':orderId')
  getOrder(
    @UserUuid() userUuid: string,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return this.orderService.getOrderById(userUuid, orderId);
  }

  @Delete(':orderId')
  cancelOrder(
    @UserUuid() userUuid: string,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return this.orderService.cancelOrder(userUuid, orderId);
  }
}
