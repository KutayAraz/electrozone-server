import { Controller, Get, Param, Query, } from '@nestjs/common';
import { SubcategoriesService } from './subcategories.service';
import { Public } from 'src/common/decorators';
import { SkipThrottle } from '@nestjs/throttler';
import { CommonQueryParams, ProcessedQueryParams, ProductQueryParams } from './types/product-query.interface';


@Controller("subcategories")
export class SubcategoriesController {
  constructor(private subcategoriesService: SubcategoriesService) { }

  private parseCommonParams(queryParams: CommonQueryParams): ProcessedQueryParams {
    const { skip, limit, stockStatus, minPriceQuery, maxPriceQuery, brandString } = queryParams;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    let priceRange: { min?: number; max?: number } | undefined;

    if (minPriceQuery || maxPriceQuery) {
      priceRange = {};
      if (minPriceQuery) priceRange.min = parseFloat(minPriceQuery);
      if (maxPriceQuery) priceRange.max = parseFloat(maxPriceQuery);
    }

    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;

    return { skip: parsedSkip, limit: parsedLimit, stockStatus, priceRange, brands };
  }

  private prepareProductQueryParams(name: string, queryParams: CommonQueryParams): ProductQueryParams {
    const processedParams = this.parseCommonParams(queryParams);
    return { subcategory: name, ...processedParams };
  }

  @Public()
  @Get(':name/brands')
  async getAllBrands(@Param("name") name: string) {
    return await this.subcategoriesService.getAllBrands(name);
  }

  @Public()
  @Get(':name/price-range')
  async getPriceRange(@Param("name") name: string, @Query('brand') brand?: string) {
    return await this.subcategoriesService.getPriceRange(name, brand);
  }

  @Public()
  @Get(":name/featured")
  async getFeaturedProducts(@Param("name") name: string, @Query() queryParams: CommonQueryParams) {
    const params = this.prepareProductQueryParams(name, queryParams);
    return await this.subcategoriesService.getFeaturedProducts(params);
  }

  @Public()
  @SkipThrottle()
  @Get(":name/rating")
  async getProductsSortedByRating(@Param("name") name: string, @Query() queryParams: CommonQueryParams) {
    const params = this.prepareProductQueryParams(name, queryParams);
    return await this.subcategoriesService.getProductsBasedOnRating(params);
  }

  @Public()
  @SkipThrottle()
  @Get(":name/price_descending")
  async getProductsSortedByPriceDescending(@Param("name") name: string, @Query() queryParams: CommonQueryParams) {
    const params = this.prepareProductQueryParams(name, queryParams);
    return await this.subcategoriesService.getProductsByPriceDesc(params);
  }

  @Public()
  @SkipThrottle()
  @Get(":name/price_ascending")
  async getProductsSortedByPriceAscending(@Param("name") name: string, @Query() queryParams: CommonQueryParams) {
    const params = this.prepareProductQueryParams(name, queryParams);
    return await this.subcategoriesService.getProductsByPriceAsc(params);
  }

  @Public()
  @Get(":name/most_wishlisted")
  async getMostWishlisted(@Param("name") name: string, @Query() queryParams: CommonQueryParams) {
    const params = this.prepareProductQueryParams(name, queryParams);
    return await this.subcategoriesService.getTopWishlistedProducts(params);
  }

  @Public()
  @Get(":name/most_sold")
  async getMostSold(@Param("name") name: string, @Query() queryParams: CommonQueryParams) {
    const params = this.prepareProductQueryParams(name, queryParams);
    return await this.subcategoriesService.getTopSelling(params);
  }
}