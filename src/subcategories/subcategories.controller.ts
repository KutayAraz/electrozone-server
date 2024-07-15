import { Controller, Get, Param, Query } from "@nestjs/common";
import { SubcategoriesService } from "./subcategories.service";
import { Public } from "src/common/decorators";
import { SkipThrottle } from "@nestjs/throttler";

@Controller("subcategories")
export class SubcategoriesController {
  constructor(private subcategoriesService: SubcategoriesService) { }

  @Public()
  @Get(':name/brands')
  getAllBrands(@Param("name") name: string,) {
    return this.subcategoriesService.getAllBrands(name);
  }

  @Public()
  @Get(':name/price-range')
  getPriceRange(@Param("name") name: string, @Query('brand') brand?: string) {
    return this.subcategoriesService.getPriceRange(name, brand);
  }

  @Public()
  @SkipThrottle()
  @Get(":name/featured")
  async getAllProducts(
    @Param("name") name: string,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPrice: number = 0,
    @Query("max_price") maxPrice?: number,
    @Query("brands") brandString?: string // This can be a single brand or an array of brands
  ) {
    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;
    const priceRange = maxPrice ? { min: minPrice, max: maxPrice } : undefined;
    return await this.subcategoriesService.getFeaturedProducts(
      name,
      skip,
      take,
      stockStatus,
      priceRange,
      brands
    );
  }

  @Public()
  @SkipThrottle()
  @Get(":name/rating")
  async getProductsSortedByRating(@Param("name") name: string,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPrice: number = 0,
    @Query("max_price") maxPrice?: number,
    @Query("brands") brandString?: string // This can be a single brand or an array of brands
  ) {
    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;
    const priceRange = maxPrice ? { min: minPrice, max: maxPrice } : undefined;
    return await this.subcategoriesService.getProductsBasedOnRating(name,
      skip,
      take,
      stockStatus,
      priceRange,
      brands);
  }

  @Public()
  @SkipThrottle()
  @Get(":name/price_descending")
  async getProductsSortedByPriceDescending(@Param("name") name: string,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPrice: number = 0,
    @Query("max_price") maxPrice?: number,
    @Query("brands") brandString?: string // This can be a single brand or an array of brands
  ) {
    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;
    const priceRange = maxPrice ? { min: minPrice, max: maxPrice } : undefined;
    return await this.subcategoriesService.getProductsByPriceDesc(name, skip, take,
      stockStatus,
      priceRange,
      brands);
  }

  @Public()
  @SkipThrottle()
  @Get(":name/price_ascending")
  async getProductsSortedByPriceAscending(@Param("name") name: string,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPriceQuery?: string,
    @Query("max_price") maxPriceQuery?: string,
    @Query("brands") brandString?: string // This can be a single brand or an array of brands
  ) {
    const minPrice = minPriceQuery ? parseFloat(minPriceQuery) : 0;
    const maxPrice = maxPriceQuery ? parseFloat(maxPriceQuery) : undefined;
    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;
    const priceRange = maxPrice ? { min: minPrice, max: maxPrice } : undefined;

    return await this.subcategoriesService.getProductsByPriceAsc(name, skip, take,
      stockStatus,
      priceRange,
      brands);
  }

  @Public()
  @Get(":name/most_wishlisted")
  async getMostWishlisted(@Param("name") name: string,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPrice: number = 0,
    @Query("max_price") maxPrice?: number,
    @Query("brands") brandString?: string // This can be a single brand or an array of brands
  ) {
    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;
    const priceRange = maxPrice ? { min: minPrice, max: maxPrice } : undefined;
    return await this.subcategoriesService.getTopWishlistedProducts(name, skip, take,
      stockStatus,
      priceRange,
      brands);
  }

  @Public()
  @Get(":name/most_sold")
  async getMostSold(@Param("name") name: string,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPrice: number = 0,
    @Query("max_price") maxPrice?: number,
    @Query("brands") brandString?: string // This can be a single brand or an array of brands
  ) {
    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;
    const priceRange = maxPrice ? { min: minPrice, max: maxPrice } : undefined;
    return await this.subcategoriesService.getTopWishlistedProducts(name, skip, take,
      stockStatus,
      priceRange,
      brands);
  }
}
