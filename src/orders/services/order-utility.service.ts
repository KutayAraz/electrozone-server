import { Injectable } from "@nestjs/common";
import { Order } from "src/entities/Order.entity";
import Decimal from "decimal.js";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { OrderItem } from "src/entities/OrderItem.detail";

@Injectable()
export class OrderUtilityService {
    constructor() { }

    cartChangedError(): AppError {
        return new AppError(
            ErrorType.CART_CHANGED,
            "Your cart has changed since checkout was initiated. Please review your cart and try again.",
        );
    }

    // Transform order item entity to DTO with calculated price
    transformOrderItem(orderItem: OrderItem) {
        return {
            id: orderItem.product.id,
            quantity: orderItem.quantity,
            price: new Decimal(orderItem.quantity)
                .times(orderItem.product.price)
                .toFixed(2),
            productName: orderItem.product.productName,
            brand: orderItem.product.brand,
            thumbnail: orderItem.product.thumbnail,
            category: orderItem.product.subcategory.category.category,
            subcategory: orderItem.product.subcategory.subcategory,
        };
    }

    // Transform order entity to DTO with calculated total quantity
    transformOrder(order: Order) {
        const orderQuantity = order.orderItems.reduce(
            (sum, item) => sum + item.quantity,
            0,
        );

        const transformedOrderItems = order.orderItems.map((item) => ({
            productId: item.product.id,
            productName: item.product.productName,
            thumbnail: item.product.thumbnail,
            subcategory: item.product.subcategory.subcategory,
            category: item.product.subcategory.category.category,
        }));

        return {
            orderId: order.id,
            orderTotal: order.orderTotal,
            orderDate: order.orderDate,
            orderQuantity,
            user: {
                firstName: order.user.firstName,
                lastName: order.user.lastName,
            },
            orderItems: transformedOrderItems,
        };
    }
}