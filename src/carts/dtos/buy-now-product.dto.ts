import { IsNumber, Max, Min } from "class-validator";

export class BuyNowProductDto {
  @IsNumber()
  @Min(1)
  productId: number;

  @IsNumber()
  @Min(1)
  @Max(20, { message: 'Quantity cannot exceed 20' })
  quantity: number;
}
