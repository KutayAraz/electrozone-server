interface ProductImage {
  id: number;
  productImage: string;
}

export interface ProductDetails {
    id: number;
    productName: string;
    brand: string;
    thumbnail: string;
    description: string;
    productImages: ProductImage[];
    averageRating: number;
    price: number;
    stock: number;
    subcategory: string;
    category: string;
  }