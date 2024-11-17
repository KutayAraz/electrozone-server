export interface CommonQueryParams {
  skip?: string;
  limit?: string;
  stockStatus?: string;
  minPriceQuery?: string;
  maxPriceQuery?: string;
  brandString?: string;
}

export interface ProcessedQueryParams {
  skip: number;
  limit: number;
  stockStatus?: string;
  priceRange?: { min?: number; max?: number };
  brands?: string[];
}

export interface ProductQueryParams extends ProcessedQueryParams {
  subcategory: string;
}

export enum ProductOrderBy {
  SOLD = "product.sold",
  RATING = "product.averageRating",
  PRICE = "product.price",
  WISHLISTED = "product.wishlisted",
}
