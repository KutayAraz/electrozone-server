import { Product } from "src/entities/Product.entity";

export interface SearchResult {
  products: Product[];
  productQuantity: number;
  brands: string[];
  subcategories: string[];
  priceRange: {
    min: number;
    max: number;
  };
}
