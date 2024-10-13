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
  Session,
  UseInterceptors,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { OrderService } from "./services/order.service";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { CheckoutType } from "./types/checkoutType.enum";
import { Response } from 'express';
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";

@Controller('order')
@UseInterceptors(ClassSerializerInterceptor)
export class OrderController {
  constructor(private orderService: OrderService) { }

  @Post("/initiate-checkout")
  async initiateOrder(
    @UserUuid() userUuid: string,
    @Res({ passthrough: true }) res: Response,
    @Session() session: Record<string, any>,
    @Body('checkoutType') checkoutType: CheckoutType) {
    const { checkoutSessionId, cartData } = await this.orderService.initiateCheckout(userUuid, checkoutType, session.id);

    // Set the cookie
    res.cookie('checkoutSessionId', checkoutSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      maxAge: 60 * 60 * 1000,
      sameSite: 'strict'
    });

    return cartData;
  }

  @Post('process-order')
  async processOrder(@UserUuid() userUuid: string, @Req() req, @Res({ passthrough: true }) res: Response) {
    const checkoutSessionId = req.cookies.checkoutSessionId;
  
    if (!checkoutSessionId) {
      throw new AppError(ErrorType.NO_CHECKOUT_SESSION, 'No active checkout session found');
    }
  
    try {
      const orderId = await this.orderService.processOrder(checkoutSessionId, userUuid);
  
      // Clear the cookie after successful order processing
      res.clearCookie('checkoutSessionId');
  
      return { orderId };
    } catch (error) {
      if (error instanceof AppError && error.type === ErrorType.CART_CHANGED) {
        // Clear the checkout session cookie
        res.clearCookie('checkoutSessionId');
      }
      throw error;
    }
  }

  @Post("/session")
  initiateSesionOrder(@UserUuid() userUuid: string, @Session() session: Record<string, any>) {
    return this.orderService.initiateCheckout(userUuid, CheckoutType.SESSION, session.id)
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
