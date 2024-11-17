import { ProductQueryResult } from "src/subcategories/types/product-query-result.type";

export interface SubcategoryTopProducts {
  subcategory: string;
  topSelling: ProductQueryResult;
  topWishlisted: ProductQueryResult;
}
