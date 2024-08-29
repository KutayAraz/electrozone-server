import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class GetPriceRangeParamsDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    brand?: string;
}