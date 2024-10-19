import { IsNumber, Min } from "class-validator";

export class OrderItemDTO {
  @IsNumber()
  @Min(1)
  productId: number;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}
