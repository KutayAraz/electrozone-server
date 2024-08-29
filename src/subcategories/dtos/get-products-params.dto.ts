import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { CommonQueryParamsDto } from "./common-query-params.dto";

export class GetProductsParamsDto extends CommonQueryParamsDto {
    @ApiProperty({ required: true, enum: ['featured', 'rating', 'price_descending', 'price_ascending', 'most_wishlisted', 'most_sold'] })
    @IsEnum(['featured', 'rating', 'price_descending', 'price_ascending', 'most_wishlisted', 'most_sold'])
    sortBy: string;
}
