import { FormattedCartItem } from "src/carts/types/formatted-cart-product.type";

export interface CheckoutSnapshot {
    cartItems: FormattedCartItem[];
    cartTotal: number;
    totalQuantity: number;
    createdAt: Date;
}
