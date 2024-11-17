import { FormattedProduct } from "./formatted-product.type";

export interface ProductQueryResult {
  products: FormattedProduct[];
  productQuantity: number;
}
