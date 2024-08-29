import { Controller, Get, Param, Query, } from '@nestjs/common';
import { SubcategoryService } from './subcategory.service';
import { Public } from 'src/common/decorators';
import { SkipThrottle } from '@nestjs/throttler';
import { CommonQueryParams, ProcessedQueryParams, ProductQueryParams } from './types/product-query.interface';
import { ApiOperation, ApiParam, ApiResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags("Subcategories")
@Controller("subcategories")
export class SubcategoryController {
  constructor(private subcategoryService: SubcategoryService) { }

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
  @ApiOperation({ summary: 'Get all brands for a subcategory' })
  @ApiParam({ name: 'name', description: 'Subcategory name' })
  @ApiResponse({ status: 200, description: 'List of brands' })
  async getAllBrands(@Param("name") name: string) {
    return await this.subcategoryService.getAllBrands(name);
  }

  @Public()
  @Get(':name/price-range')
  @ApiOperation({ summary: 'Get price range for a subcategory' })
  @ApiParam({ name: 'name', description: 'Subcategory name' })
  @ApiQuery({ name: 'brand', required: false, description: 'Filter by brand' })
  @ApiResponse({ status: 200, description: 'Price range' })
  async getPriceRange(@Param("name") name: string, @Query('brand') brand?: string) {
    return await this.subcategoryService.getPriceRange(name, brand);
  }

  @Public()
  @SkipThrottle()
  @Get(":name")
  @ApiOperation({ summary: 'Get products for a subcategory with various sorting options' })
  @ApiParam({ name: 'name', description: 'Subcategory name' })
  @ApiQuery({
    name: 'sortBy',
    enum: ['featured', 'rating', 'price_descending', 'price_ascending', 'most_wishlisted', 'most_sold'],
    required: true,
    description: 'Sorting type for products'
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'stockStatus', required: false, enum: ['in_stock', 'all'] })
  @ApiQuery({ name: 'minPriceQuery', required: false, type: Number })
  @ApiQuery({ name: 'maxPriceQuery', required: false, type: Number })
  @ApiQuery({ name: 'brandString', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of products' })
  async getProducts(
    @Param("name") name: string,
    @Query('sort_by') sortBy: string,
    @Query() queryParams: CommonQueryParams
  ) {
    const params = this.prepareProductQueryParams(name, queryParams);
    switch (sortBy) {
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
        throw new Error("Invalid sort type");
    }
  }
}