import { Injectable, HttpStatus } from "@nestjs/common";
import { ErrorType } from "src/common/errors/error-type";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Repository, EntityManager } from "typeorm";
import { AppError } from "src/common/errors/app-error";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { OrderItemDTO } from "../dtos/order-item.dto";
import Decimal from "decimal.js";
import { FormattedCartItem } from "src/carts/types/formatted-cart-product.type";
import { OrderUtilityService } from "./order-utility.service";

@Injectable()
export class OrderValidationService {
  constructor(
    private readonly commonValidationService: CommonValidationService,
    private readonly orderUtilityService: OrderUtilityService,
  ) { }


  async validateOrderWithCart(
    cartItems: FormattedCartItem[],
    orderItems: OrderItemDTO[],
    transactionManager: EntityManager,
  ) {
    if (cartItems.length !== orderItems.length) {
      throw this.orderUtilityService.cartChangedError();
    }

    return await Promise.all(
      cartItems.map(async (cartItem) => {
        const orderItem = orderItems.find(
          (item) => item.productId === cartItem.id,
        );
        if (!orderItem || orderItem.quantity !== cartItem.quantity) {
          throw this.orderUtilityService.cartChangedError();
        }

        // Validate prices match within tolerance
        const priceDifference = new Decimal(orderItem.price)
          .minus(new Decimal(cartItem.price))
          .abs();
        if (!priceDifference.lessThanOrEqualTo("0.01")) {
          throw this.orderUtilityService.cartChangedError();
        }

        const product = await this.validateOrderItem(
          orderItem,
          transactionManager,
        );

        const orderItemTotal = new Decimal(orderItem.price)
          .times(orderItem.quantity)
          .toFixed(2);

        return { orderItem, product, orderItemTotal };
      }),
    );
  }

  async validateOrderItem(
    orderItem: OrderItemDTO,
    transactionManager: EntityManager,
  ) {
    const product = await transactionManager.findOneBy(Product, {
      id: orderItem.productId,
    });

    this.commonValidationService.validateProduct(product);
    this.commonValidationService.validatePrice(
      product,
      new Decimal(orderItem.price).toFixed(2),
    );
    this.commonValidationService.validateQuantity(orderItem.quantity);
    this.commonValidationService.validateStockAvailability(
      product,
      orderItem.quantity,
    );

    return product;
  }

  async validateIdempotency(
    idempotencyKey: string,
    orderRepo: Repository<Order>,
  ): Promise<Order | null> {
    return await orderRepo.findOne({ where: { idempotencyKey } });
  }

  async validateUserOrder(
    userUuid: string,
    orderId: number,
    ordersRepo: Repository<Order>,
  ) {
    const order = await ordersRepo.findOne({
      where: { id: orderId },
      relations: ["user", "orderItems"],
    });

    this.validateOrder(order, orderId);

    if (order.user.uuid !== userUuid) {
      throw new AppError(
        ErrorType.UNAUTHORIZED_ORDER_CANCELLATION,
        `You are not authorized to cancel order with id of ${orderId}`,
        HttpStatus.FORBIDDEN,
      );
    }

    return order;
  }

  isOrderCancellable(orderDate: Date): boolean {
    return new Date().getTime() - orderDate.getTime() <= 86400000;
  }

  validateOrder(order: Order, orderId?: number) {
    if (!order) {
      throw new AppError(
        ErrorType.ORDER_NOT_FOUND,
        `Order${orderId ? ` with id of ${orderId}` : ''} is not found`,
      );
    }
  }
}
