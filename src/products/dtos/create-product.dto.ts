import { IsNumber, IsString } from "class-validator";

export class CreateProductDto {
  @IsString()
  productName: string;

  @IsString()
  brand: string;

  @IsString()
  description: string;

  @IsString()
  thumbnail: string;

  @IsNumber()
  stock: number;

  @IsNumber()
  price: number;

  @IsNumber()
  subcategoryId: number;
}
