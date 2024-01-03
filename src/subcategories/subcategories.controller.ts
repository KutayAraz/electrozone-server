import { Controller, Get, Param, Query } from "@nestjs/common";
import { SubcategoriesService } from "./subcategories.service";
import { Public } from "src/common/decorators";

@Controller("subcategories")
export class SubcategoriesController {
  constructor(private subcategoriesService: SubcategoriesService) { }

  @Public()
  @Get(":name/featured")
  async getAllProducts(@Param("name") name: string, @Query("page") page: number = 1, @Query("limit") limit: number = 5) {
    return await this.subcategoriesService.getFeaturedProducts(name, page, limit);
  }

  @Public()
  @Get(":name/rating")
  async getProductsSortedByRating(@Param("name") name: string, @Query("page") page: number = 1, @Query("limit") limit: number = 5) {
    return await this.subcategoriesService.getProductsBasedOnRating(name, page, limit);
  }

  @Public()
  @Get(":name/price_descending")
  async getProductsSortedByPriceDescending(@Param("name") name: string, @Query("page") page: number = 1, @Query("limit") limit: number = 5) {
    return await this.subcategoriesService.getProductsByPriceDesc(name, page, limit);
  }

  @Public()
  @Get(":name/price_ascending")
  async getProductsSortedByPriceAscending(@Param("name") name: string, @Query("page") page: number = 1, @Query("limit") limit: number = 5) {
    return await this.subcategoriesService.getProductsByPriceAsc(name, page, limit);
  }

  @Public()
  @Get(":name/most_wishlisted")
  async getMostWishlisted(@Param("name") name: string, @Query("page") page: number = 1, @Query("limit") limit: number = 5) {
    return await this.subcategoriesService.getTopWishlistedProducts(name, page, limit);
  }

  @Public()
  @Get(":name/most_sold")
  async getMostSold(@Param("name") name: string, @Query("page") page: number = 1, @Query("limit") limit: number = 5) {
    return await this.subcategoriesService.getTopWishlistedProducts(name, page, limit);
  }
}
