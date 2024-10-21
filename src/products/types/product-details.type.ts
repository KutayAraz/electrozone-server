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
    averageRating: string;
    price: string;
    stock: number;
    subcategory: string;
    category: string;
  }