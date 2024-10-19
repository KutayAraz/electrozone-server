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
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { OrderService } from "./services/order.service";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { CheckoutType } from "./types/checkoutType.enum";
import { Response } from 'express';
import { OrderItemDTO } from "./dtos/order-item.dto";

@Controller('order')
@UseInterceptors(ClassSerializerInterceptor)
export class OrderController {
  constructor(private orderService: OrderService) { }

  @Post("/initiate-checkout")
  async initiateOrder(
    @UserUuid() userUuid: string,
    @Res({ passthrough: true }) res: Response,
    @Body('checkoutType') checkoutType: CheckoutType) {
    const { cartData } = await this.orderService.initiateCheckout(userUuid, checkoutType);
    return cartData;
  }

  @Post('process-order')
  async processOrder(
    @UserUuid() userUuid: string,
    @Body('checkoutType') checkoutType: CheckoutType,
    @Body('cartItems') orderItemDto: OrderItemDTO[],
    @Body("idempotencyKey") idempotencyKey: string
  ) {
    const orderId = await this.orderService.processOrder(userUuid, checkoutType, orderItemDto, idempotencyKey);
    return { orderId };
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
