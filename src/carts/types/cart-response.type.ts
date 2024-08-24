import { FormattedCartProduct } from "./formatted-cart-product.type";
import { PriceChange } from "./price-change.type";
import { QuantityChange } from "./quantity-change.type";

export interface CartResponse {
    cartTotal: number;
    totalQuantity: number;
    products: FormattedCartProduct[];
    removedItems: string[];
    priceChanges: PriceChange[];
    quantityChanges: QuantityChange[];
}