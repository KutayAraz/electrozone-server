import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, HttpStatus } from "@nestjs/common";
import { ErrorType } from "src/common/errors/error-type";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Repository, EntityManager } from "typeorm";
import { CreateOrderItemDTO } from "../dtos/order-item.dto";
import { AppError } from "src/common/errors/app-error";
import { CommonValidationService } from "src/common/services/common-validation.service";

@Injectable()
export class OrderValidationService {
  constructor(
    private readonly commonValidationService: CommonValidationService,
  ) { }

  async validateOrderItem(orderItem: CreateOrderItemDTO, transactionManager: EntityManager) {
    const product = await transactionManager.findOneBy(Product, { id: orderItem.productId });

    this.commonValidationService.validateProduct(product)
    this.commonValidationService.validatePrice(product, orderItem.price)
    this.commonValidationService.validateQuantity(orderItem.quantity)
    this.commonValidationService.validateStockAvailability(product, orderItem.quantity)

    return product;
  }

  async validateUserOrder(userUuid: string, orderId: number, ordersRepo: Repository<Order>) {
    const order = await ordersRepo.findOne({
      where: { id: orderId },
      relations: ["user", "orderItems"],
    });

    this.validateOrder(order)

    if (order.user.uuid !== userUuid) {
      throw new AppError(
        ErrorType.UNAUTHORIZED_ORDER_CANCELLATION,
        `You are not authorized to cancel order with id of ${orderId}`,
        HttpStatus.FORBIDDEN
      );
    }

    return order;
  }

  isOrderCancellable(orderDate: Date): boolean {
    return new Date().getTime() - orderDate.getTime() <= 86400000;
  }

  validateOrder(order: Order) {
    if (!order) {
      throw new AppError(ErrorType.ORDER_NOT_FOUND, `Order with id of ${order.id} is not found`)
    }
  }
}