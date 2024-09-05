import { HttpStatus, Injectable } from '@nestjs/common';
import { Product } from 'src/entities/Product.entity';
import { User } from 'src/entities/User.entity';
import { AppError } from '../errors/app-error';
import { ErrorType } from '../errors/error-type';

@Injectable()
export class CommonValidationService {
    validateUser(user: User): void {
        if (!user) {
            throw new AppError(ErrorType.USER_NOT_FOUND, "User not found.");
        }
    }

    validateProduct(product: Product): void {
        if (!product) {
            throw new AppError(ErrorType.PRODUCT_NOT_FOUND, "Product not found.");
        }
    }

    validateQuantity(quantity: number, product: Product): void {
        this.validateProduct(product);
        if (quantity > 10) {
            throw new AppError(
                ErrorType.QUANTITY_LIMIT_EXCEEDED,
                `Quantity for ${product.productName} exceeds the allowed limit of 10.`
            );
        }
    }

    validatePrice(product: Product, addedPrice: number): void {
        this.validateProduct(product);
        if (product.price !== addedPrice) {
            throw new AppError(
                ErrorType.PRODUCT_PRICE_CHANGED,
                `Price of ${product.productName} has changed. Expected: ${product.price}, Received: ${addedPrice}.`
            );
        }
    }

    validateStock(product: Product): void {
        this.validateProduct(product);
        if (product.stock <= 0) {
            throw new AppError(
                ErrorType.OUT_OF_STOCK,
                `${product.productName} is out of stock.`
            );
        }
    }

    validateStockAvailability(product: Product, quantity: number): void {
        this.validateProduct(product);
        if (product.stock < quantity) {
            throw new AppError(
                ErrorType.STOCK_LIMIT_EXCEEDED,
                `Requested quantity (${quantity}) for ${product.productName} exceeds available stock (${product.stock}).`
            );
        }
    }
}