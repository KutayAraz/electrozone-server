import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CommonQueryParamsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(['in_stock', 'all'])
  stockStatus?: 'in_stock' | 'all';

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPriceQuery?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPriceQuery?: number;

  @IsOptional()
  @IsString()
  brandString?: string;
}
