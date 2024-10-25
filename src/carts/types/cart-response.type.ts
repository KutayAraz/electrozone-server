import { FormattedCartItem } from "./formatted-cart-product.type";
import { PriceChange } from "./price-change.type";
import { QuantityChange } from "./quantity-change.type";

export interface CartResponse {
    cartTotal: string;
    totalQuantity: number;
    cartItems: FormattedCartItem[];
    removedCartItems?: string[];
    priceChanges?: PriceChange[];
    quantityChanges?: QuantityChange[];
}