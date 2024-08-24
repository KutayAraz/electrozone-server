import { Injectable } from "@nestjs/common";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";

@Injectable()
export class CartValidationService {
    validateUser(user: User): void {
        if (!user) throw new AppError(ErrorType.USER_NOT_FOUND);
    }

    validateQuantity(quantity: number): void {
        if (quantity > 10) {
            throw new AppError(ErrorType.QUANTITY_LIMIT_EXCEEDED);
        }
    }

    validateStock(product: Product): void {
        if (product.stock <= 0) {
            throw new AppError(ErrorType.OUT_OF_STOCK, product.id, product.productName);
        }
    }

    validateProduct(product: Product): void {
        if (!product) {
            throw new AppError(ErrorType.PRODUCT_NOT_FOUND, product.id, product.productName);
        }
    }

    validateCartItem(cartItem: CartItem): void {
        if (!cartItem) {
            throw new AppError(ErrorType.PRODUCT_NOT_FOUND, cartItem.product.id, cartItem.product.productName);
        }
    }

    validateStockAvailability(product: Product, quantity: number): void {
        if (product.stock < quantity) {
            throw new AppError(ErrorType.STOCK_LIMIT_EXCEEDED, product.id, product.productName);
        }
    }
}