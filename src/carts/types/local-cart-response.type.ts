import { FormattedCartItem } from "./formatted-cart-item.type";
import { QuantityChange } from "./quantity-change.type";

export interface LocalCartResponse {
  cartTotal: number;
  totalQuantity: number;
  products: FormattedCartItem[];
  removedCartItems: string[];
  message?: string;
  quantityAdjustments: QuantityChange[];
}
