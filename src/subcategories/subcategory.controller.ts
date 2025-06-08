import { Controller, Get, Param, Query } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "src/common/decorators/public.decorator";
import { SubcategoryService } from "./subcategory.service";
import { ProductQueryResult } from "./types/product-query-result.type";
import {
  CommonQueryParams,
  ProcessedQueryParams,
  ProductQueryParams,
} from "./types/product-query.interface";

@Controller("subcategory")
export class SubcategoryController {
  constructor(private subcategoryService: SubcategoryService) {}

  private parseCommonParams(queryParams: CommonQueryParams): ProcessedQueryParams {
    const { skip, limit, stock_status, min_price, max_price, brands } = queryParams;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    let priceRange: { min?: number; max?: number } | undefined;

    if (min_price || max_price) {
      priceRange = {};
      if (min_price) priceRange.min = parseFloat(min_price);
      if (max_price) priceRange.max = parseFloat(max_price);
    }

    const brandsArray = brands ? brands.split(" ").map(decodeURIComponent) : undefined;

    return {
      skip: parsedSkip,
      limit: parsedLimit,
      stockStatus: stock_status,
      priceRange,
      brands: brandsArray,
    };
  }

  private prepareProductQueryParams(
    name: string,
    queryParams: CommonQueryParams,
  ): ProductQueryParams {
    const processedParams = this.parseCommonParams(queryParams);
    return { subcategory: name, ...processedParams };
  }

  @Public()
  @Get(":name/brands")
  async getAllBrands(@Param("name") name: string): Promise<string[]> {
    return await this.subcategoryService.getAllBrands(name);
  }

  @Public()
  @Get(":name/price-range")
  async getPriceRange(
    @Param("name") name: string,
    @Query("brand") brand?: string,
  ): Promise<{ min: string; max: string }> {
    return await this.subcategoryService.getPriceRange(name, brand);
  }

  @Public()
  @SkipThrottle()
  @Get(":name")
  async getProducts(
    @Param("name") name: string,
    @Query("sort") sort: string = "featured",
    @Query() queryParams: CommonQueryParams,
  ): Promise<ProductQueryResult> {
    const params = this.prepareProductQueryParams(name, queryParams);
    switch (sort) {
      case "featured":
        return await this.subcategoryService.getFeaturedProducts(params);
      case "rating":
        return await this.subcategoryService.getProductsBasedOnRating(params);
      case "price_descending":
        return await this.subcategoryService.getProductsByPriceDesc(params);
      case "price_ascending":
        return await this.subcategoryService.getProductsByPriceAsc(params);
      case "most_wishlisted":
        return await this.subcategoryService.getTopWishlistedProducts(params);
      case "most_sold":
        return await this.subcategoryService.getTopSelling(params);
      default:
        return await this.subcategoryService.getFeaturedProducts(params);
    }
  }
}
