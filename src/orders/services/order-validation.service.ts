import { Injectable, HttpStatus } from "@nestjs/common";
import { ErrorType } from "src/common/errors/error-type";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Repository, EntityManager } from "typeorm";
import { AppError } from "src/common/errors/app-error";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { OrderItem } from "../types/order-item.type";
import { CheckoutSnapshot } from "../types/checkout-snapshot.type";
import Decimal from "decimal.js";
import { FormattedCartItem } from "src/carts/types/formatted-cart-product.type";

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

    // Check session expiry (15 minutes)
    const sessionAge = Date.now() - snapshot.createdAt.getTime();
    if (sessionAge > 15 * 60 * 1000) {
      throw new AppError(
        ErrorType.CHECKOUT_SESSION_EXPIRED,
        "Checkout session has expired. Please start checkout again.",
      );
    }
  }

  async validateIdempotency(
    idempotencyKey: string,
    orderRepo: Repository<Order>,
  ): Promise<Order | null> {
    return await orderRepo.findOne({ where: { idempotencyKey } });
  }

  async validateOrderItem(orderItem: OrderItem, transactionManager: EntityManager) {
    const product = await transactionManager.findOneBy(Product, {
      id: orderItem.productId,
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
  ): Promise<
    Array<{
      validatedOrderItem: FormattedCartItem;
      product: Product;
      orderItemTotal: string;
    }>
  > {
    return await Promise.all(
      cartItems.map(async (cartItem: FormattedCartItem) => {
        const product = await this.validateOrderItem(
          {
            productId: cartItem.id,
            price: cartItem.price,
            quantity: cartItem.quantity,
          },
          transactionManager,
        );

        const orderItemTotal = new Decimal(cartItem.price).times(cartItem.quantity).toFixed(2);

        return { validatedOrderItem: cartItem, product, orderItemTotal };
      }),
    );
  }

  async validateUserOrder(userUuid: string, orderId: number, ordersRepo: Repository<Order>) {
    const order = await ordersRepo.findOne({
      where: { id: orderId },
      relations: ["user", "orderItems"],
    });

    this.validateOrder(order);

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

  validateOrder(order: Order) {
    if (!order) {
      throw new AppError(ErrorType.ORDER_NOT_FOUND, `Order with id of ${order.id} is not found`);
    }
  }
}
