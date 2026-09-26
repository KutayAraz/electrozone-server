import { HttpStatus, Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import { FormattedCartItem } from "src/carts/types/formatted-cart-item.type";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { EntityManager, Repository } from "typeorm";
import { CheckoutSnapshot } from "../types/checkout-snapshot.type";
import { OrderItem } from "../types/order-item.type";
import { ValidatedOrderItem } from "../types/validated-order-item.type";

@Injectable()
export class OrderValidationService {
  constructor(private readonly commonValidationService: CommonValidationService) {}

  validateCheckoutSession(snapshot: CheckoutSnapshot, userUuid: string): void {
    if (!snapshot) {
      throw new AppError(
        ErrorType.NO_CHECKOUT_SESSION,
        "No active checkout session found. Please start checkout again.",
      );
    }

    if (snapshot.userUuid !== userUuid) {
      throw new AppError(
        ErrorType.ACCESS_DENIED,
        "You are not authorized to process checkout from this cart.",
        HttpStatus.FORBIDDEN,
      );
    }

    // Check session expiry (15 minutes). createdAt is an ISO string after the Redis round trip.
    const sessionAge = Date.now() - new Date(snapshot.createdAt).getTime();
    if (sessionAge > 15 * 60 * 1000) {
      throw new AppError(
        ErrorType.CHECKOUT_SESSION_EXPIRED,
        "Checkout session has expired. Please start checkout again.",
      );
    }
  }

  async validateIdempotency(
    idempotencyKey: string,
    userUuid: string,
    orderRepo: Repository<Order>,
  ): Promise<Order | null> {
    // TypeORM ignores undefined values in `where`, which would match any order
    if (!idempotencyKey) {
      throw new AppError(ErrorType.INVALID_INPUT, "An idempotency key is required");
    }

    return await orderRepo.findOne({ where: { idempotencyKey, user: { uuid: userUuid } } });
  }

  async validateOrderItem(orderItem: OrderItem, transactionManager: EntityManager) {
    const product = await transactionManager.findOne(Product, {
      where: { id: orderItem.productId },
      lock: { mode: "pessimistic_write" },
    });

    this.commonValidationService.validateProduct(product);
    this.commonValidationService.validatePrice(product, orderItem.price);
    this.commonValidationService.validateQuantity(orderItem.quantity);
    this.commonValidationService.validateStockAvailability(product, orderItem.quantity);

    return product;
  }

  async validateOrderItems(
    cartItems: FormattedCartItem[],
    transactionManager: EntityManager,
  ): Promise<ValidatedOrderItem[]> {
    // Locked in ascending id order so concurrent orders cannot deadlock
    const sortedCartItems = [...cartItems].sort((a, b) => a.id - b.id);
    const validatedItems: ValidatedOrderItem[] = [];

    for (const cartItem of sortedCartItems) {
      const product = await this.validateOrderItem(
        {
          productId: cartItem.id,
          price: cartItem.price,
          quantity: cartItem.quantity,
        },
        transactionManager,
      );

      const orderItemTotal = new Decimal(cartItem.price).times(cartItem.quantity).toFixed(2);

      validatedItems.push({ validatedOrderItem: cartItem, product, orderItemTotal });
    }

    return validatedItems;
  }

  async validateUserOrder(userUuid: string, orderId: number, ordersRepo: Repository<Order>) {
    const order = await ordersRepo.findOne({
      where: { id: orderId },
      relations: ["user", "orderItems", "orderItems.product"],
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

  validateOrder(order: Order | null, orderId: number) {
    if (!order) {
      throw new AppError(
        ErrorType.ORDER_NOT_FOUND,
        `Order with id of ${orderId} is not found`,
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
