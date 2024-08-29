import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CommonQueryParamsDto {
  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false, enum: ['in_stock', 'all'] })
  @IsOptional()
  @IsEnum(['in_stock', 'all'])
  stockStatus?: 'in_stock' | 'all';

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPriceQuery?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPriceQuery?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brandString?: string;
}
