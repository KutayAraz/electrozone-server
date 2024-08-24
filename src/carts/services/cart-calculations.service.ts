import { Injectable } from "@nestjs/common";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { EntityManager } from "typeorm";
import { FormattedCartProduct } from "../types/formatted-cart-product.type";
import { PriceChange } from "../types/price-change.type";
import QuantityChange from "../types/quantity-change.type";

@Injectable()
export class CartCalculationsService {
    async updateCartItem(item: CartItem, transactionManager: EntityManager) {
        const currentPrice = item.product.price;
        const addedPrice = item.addedPrice;
        let quantity = item.quantity;
        let quantityChange: QuantityChange | null = null;
        let priceChange: PriceChange | null = null;

        if (quantity > item.product.stock || quantity > 10) {
            const oldQuantity = quantity;
            quantity = Math.min(item.product.stock, 10);
            quantityChange = {
                productName: item.product.productName,
                oldQuantity,
                newQuantity: quantity,
                reason: quantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
            };
            await transactionManager.update(CartItem, item.id, {
                quantity,
                amount: currentPrice * quantity
            });
        }

        if (addedPrice !== null && addedPrice !== undefined && currentPrice !== addedPrice) {
            priceChange = {
                productName: item.product.productName,
                oldPrice: addedPrice,
                newPrice: currentPrice,
            };
            await transactionManager.update(CartItem, item.id, {
                addedPrice: currentPrice,
                amount: currentPrice * quantity
            });
        }

        return { updatedItem: { ...item, quantity, addedPrice: currentPrice }, quantityChange, priceChange };
    }

    formatCartProduct(item: CartItem): FormattedCartProduct {
        return {
            cartItemId: item.id,
            quantity: item.quantity,
            amount: item.product.price * item.quantity,
            id: item.product.id,
            productName: item.product.productName,
            avgRating: item.product.averageRating,
            thumbnail: item.product.thumbnail,
            price: item.product.price,
            subcategory: item.product.subcategory.subcategory,
            category: item.product.subcategory.category.category,
        };
    }

}