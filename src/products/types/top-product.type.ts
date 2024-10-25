export interface TopProduct {
    id: number;
    productName: string;
    brand: string;
    thumbnail: string;
    averageRating: string;
    price: string;
    stock: number;
    subcategory: string;
    category: string;
    sold?: number;
    wishlisted?: number;
  }