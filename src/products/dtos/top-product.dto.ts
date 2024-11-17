export default class TopProductDto {
  id: number;
  productName: string;
  brand: string;
  thumbnail: string;
  averageRating: number;
  price: number;
  stock: number;
  subcategory: string;
  category: string;
  sold?: number;
  wishlisted?: number;
}
