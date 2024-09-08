import { Product } from "src/entities/Product.entity";

export interface SearchResult {
    products: Product[];
    productQuantity: number;
    availableBrands: string[];
    availableSubcategories: string[];
    priceRange: {
        min: number;
        max: number;
    };
}