import { IsNumber, Min } from "class-validator";

export class CartItemDto {
  @IsNumber()
  quantity: number;

  @IsNumber()
  productId: number;
}
