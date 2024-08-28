import { Injectable } from '@nestjs/common';
import { Product } from 'src/entities/Product.entity';
import { User } from 'src/entities/User.entity';
import { AppError } from '../errors/app-error';
import { ErrorType } from '../errors/error-type';

@Injectable()
export class CommonValidationService {
    validateUser(user: User): void {
        if (!user)
            throw new AppError(ErrorType.USER_NOT_FOUND);
    }

    validateProduct(product: Product): void {
        if (!product)
            throw new AppError(ErrorType.PRODUCT_NOT_FOUND, product.id, product.productName);
    }

    validateQuantity(quantity: number, product?: Product): void {
        if (quantity > 10)
            throw new AppError(ErrorType.QUANTITY_LIMIT_EXCEEDED, product.id, product.productName);
    }

    validatePrice(product: Product, addedPrice: number) {
        if (product.price !== addedPrice)
            throw new AppError(ErrorType.PRODUCT_PRICE_CHANGED, product.id, product.productName);
    }

    validateStock(product: Product): void {
        if (product.stock <= 0)
            throw new AppError(ErrorType.OUT_OF_STOCK, product.id, product.productName);
    }

    validateStockAvailability(product: Product, quantity: number): void {
        if (product.stock < quantity)
            throw new AppError(ErrorType.STOCK_LIMIT_EXCEEDED, product.id, product.productName);
    }
}