export interface SuggestedProduct {
  id: number;
  productName: string;
  brand: string;
  thumbnail: string;
  averageRating: string;
  price: string;
  stock: number;
  subcategory: string;
  category: string;
}

export interface SuggestedProducts {
  suggestionType: string;
  products: SuggestedProduct[];
}
