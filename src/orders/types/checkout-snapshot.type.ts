import { FormattedCartItem } from "src/carts/types/formatted-cart-product.type";
import { CheckoutType } from "./checkoutType.enum";

export interface CheckoutSnapshot {
  id: string;
  userUuid: string;
  cartItems: FormattedCartItem[];
  cartTotal: number;
  totalQuantity: number;
  createdAt: Date;
  checkoutType: CheckoutType;
  sessionId: string;
}
