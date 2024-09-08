export interface SuggestedProduct {
    id: number;
    productName: string;
    brand: string;
    thumbnail: string;
    averageRating: number;
    price: number;
    stock: number;
    subcategory: string;
    category: string;
}

export interface SuggestedProducts {
    suggestionType: string;
    products: SuggestedProduct[];
}