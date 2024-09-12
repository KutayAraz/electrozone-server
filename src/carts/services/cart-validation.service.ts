import { Injectable } from "@nestjs/common";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";

@Injectable()
export class CartValidationService {
    validateCartItem(cartItem: CartItem): void {
        if (!cartItem) {
            throw new AppError(ErrorType.PRODUCT_NOT_FOUND, "cartItem.product.id, cartItem.product.productName");
        }
    }
}