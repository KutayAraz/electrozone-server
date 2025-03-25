import { FormattedCartItem } from "src/carts/types/formatted-cart-item.type";
import { CheckoutType } from "./checkoutType.enum";

export interface CheckoutSnapshot {
  id: string;
  userUuid: string;
  cartItems: FormattedCartItem[];
  cartTotal: string;
  totalQuantity: number;
  createdAt: Date;
  checkoutType: CheckoutType;
  sessionId?: string;
}
