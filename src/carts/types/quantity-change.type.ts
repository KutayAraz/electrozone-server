import { ErrorType } from "src/common/errors/error-type";

export interface QuantityChange {
  productName: string;
  oldQuantity: number;
  newQuantity: number;
  reason: ErrorType.QUANTITY_LIMIT_EXCEEDED | ErrorType.STOCK_LIMIT_EXCEEDED;
}
