import { FormattedCartProduct } from "./formatted-cart-product.type";

export interface CartResponse {
    cartTotal: number;
    totalQuantity: number;
    products: FormattedCartProduct[];
}