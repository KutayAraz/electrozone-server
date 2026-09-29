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
  Session,
  UseInterceptors,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { clampPageSize, parseOffset } from "src/common/utils/query-params";
import { ProcessOrderDto } from "./dtos/process-order.dto";
import { OrderService } from "./services/order.service";
import { CheckoutType } from "./types/checkoutType.enum";

@Controller("order")
@UseInterceptors(ClassSerializerInterceptor)
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post("initiate-checkout")
  async initiateCheckout(
    @UserUuid() userUuid: string,
    @Session() session: Record<string, any>,
    @Body("checkoutType") checkoutType: CheckoutType,
  ) {
    const { checkoutSnapshotId, cartData } = await this.orderService.initiateCheckout(
      userUuid,
      checkoutType,
      session?.id,
    );
    return { checkoutSnapshotId, cartData };
  }

  @Post("process-order")
  async processOrder(
    @UserUuid() userUuid: string,
    @Body() { checkoutSnapshotId, idempotencyKey }: ProcessOrderDto,
  ) {
    const orderId = await this.orderService.processOrder(
      userUuid,
      checkoutSnapshotId,
      idempotencyKey,
    );
    return { orderId };
  }

  @Get()
  @SkipThrottle()
  getOrdersForUser(
    @UserUuid() userUuid: string,
    @Query("skip", new ParseIntPipe({ optional: true })) skip?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) take?: number,
  ) {
    return this.orderService.getOrdersForUser(userUuid, parseOffset(skip), clampPageSize(take, 10));
  }

  @Get(":orderId")
  getOrder(@UserUuid() userUuid: string, @Param("orderId", ParseIntPipe) orderId: number) {
    return this.orderService.getOrderById(userUuid, orderId);
  }

  @Delete(":orderId")
  cancelOrder(@UserUuid() userUuid: string, @Param("orderId", ParseIntPipe) orderId: number) {
    return this.orderService.cancelOrder(userUuid, orderId);
  }
}
