import { FormattedCartProduct } from "./formatted-cart-product.type";
import QuantityChange from "./quantity-change.type";

export interface LocalCartResponse {
    cartTotal: number;
    totalQuantity: number;
    products: FormattedCartProduct[];
    removedItems: string[];
    message?: string;
    quantityAdjustments: QuantityChange[]
}