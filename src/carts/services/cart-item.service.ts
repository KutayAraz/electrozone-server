import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { PriceChange } from "../types/price-change.type";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { QuantityChange } from "../types/quantity-change.type";
import { FormattedCartItem } from "../types/formatted-cart-product.type";
import { CartUtilityService } from "./cart-utility.service";

@Injectable()
export class CartItemService {
    constructor(private readonly cartUtilityService: CartUtilityService) { }

    async fetchAndUpdateCartItems(cartId: number, transactionManager: EntityManager): Promise<{
        cartItems: FormattedCartItem[],
        removedCartItems: string[],
        priceChanges: PriceChange[],
        quantityChanges: QuantityChange[]
    }> {
        const cartItems = await this.cartUtilityService.getCartItems(cartId, transactionManager);

        const formattedCartItems: FormattedCartItem[] = [];
        const removedCartItems: string[] = [];
        const priceChanges: PriceChange[] = [];
        const quantityChanges: QuantityChange[] = [];

        await Promise.all(cartItems.map(async (cartItem) => {
            if (cartItem.product.stock > 0) {
                const { updatedCartItem, quantityChange, priceChange } =
                    await this.updateCartItem(cartItem, transactionManager);

                    formattedCartItems.push(this.formatCartProduct(updatedCartItem));
                if (quantityChange) quantityChanges.push(quantityChange);
                if (priceChange) priceChanges.push(priceChange);
            } else {
                await transactionManager.delete(CartItem, cartItem.id);
                removedCartItems.push(cartItem.product.productName);
            }
        }));

        return { cartItems: formattedCartItems, removedCartItems, priceChanges, quantityChanges };
    }

    async updateCartItem(cartItem: CartItem, transactionManager: EntityManager) {
        const currentPrice = cartItem.product.price;
        const addedPrice = cartItem.addedPrice;
        let quantity = cartItem.quantity;
        let quantityChange: QuantityChange | null = null;
        let priceChange: PriceChange | null = null;

        if (quantity > cartItem.product.stock || quantity > 10) {
            const oldQuantity = quantity;
            quantity = Math.min(cartItem.product.stock, 10);
            quantityChange = {
                productName: cartItem.product.productName,
                oldQuantity,
                newQuantity: quantity,
                reason: quantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
            };
            await transactionManager.update(CartItem, cartItem.id, {
                quantity,
                amount: currentPrice * quantity
            });
        }

        if (addedPrice !== null && addedPrice !== undefined && currentPrice !== addedPrice) {
            priceChange = {
                productName: cartItem.product.productName,
                oldPrice: addedPrice,
                newPrice: currentPrice,
            };
            await transactionManager.update(CartItem, cartItem.id, {
                addedPrice: currentPrice,
                amount: currentPrice * quantity
            });
        }

        return { updatedCartItem: { ...cartItem, quantity, addedPrice: currentPrice }, quantityChange, priceChange };
    }

    formatCartProduct(item: CartItem): FormattedCartItem {
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