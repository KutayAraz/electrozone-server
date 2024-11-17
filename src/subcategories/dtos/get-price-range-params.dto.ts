import { IsOptional, IsString } from "class-validator";

export class GetPriceRangeParamsDto {
  @IsOptional()
  @IsString()
  brand?: string;
}
