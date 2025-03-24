import { FormattedCartItem } from "src/carts/types/formatted-cart-item.type";
import { Product } from "src/entities/Product.entity";

export interface ValidatedOrderItem {
  validatedOrderItem: FormattedCartItem;
  product: Product;
  orderItemTotal: string;
}
