import { IsEnum } from "class-validator";
import { CommonQueryParamsDto } from "./common-query-params.dto";

export class GetProductsParamsDto extends CommonQueryParamsDto {
    @IsEnum(['featured', 'rating', 'price_descending', 'price_ascending', 'most_wishlisted', 'most_sold'])
    sortBy: string;
}
