import { PriceChange } from "./price-change.type";
import { QuantityChange } from "./quantity-change.type";

export interface CartOperationResponse {
  success: boolean;
  priceChanges?: PriceChange[];
  quantityChanges?: QuantityChange[];
  removedCartItems?: string[];
}
