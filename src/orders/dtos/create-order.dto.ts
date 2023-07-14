import { IsNumber, Max, Min } from "class-validator";

export class CreateOrderDto {
  @IsNumber()
  @Min(0.5)
  @Max(100000)
  orderTotal: number;
}
