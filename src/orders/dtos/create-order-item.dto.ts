import { IsNumber, Min } from "class-validator";

export class CreateOrderItemDTO {
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  price: number;

  @IsNumber()
  productId: number;
}
