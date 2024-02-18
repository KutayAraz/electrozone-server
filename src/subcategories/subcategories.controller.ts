import { Controller, Get, Param, Query } from "@nestjs/common";
import { SubcategoriesService } from "./subcategories.service";
import { Public } from "src/common/decorators";

@Controller("subcategories")
export class SubcategoriesController {
  constructor(private subcategoriesService: SubcategoriesService) { }

  @Public()
  @Get(":name/featured")
  async getAllProducts(@Param("name") name: string, @Query("skip") skip: number = 0, @Query("limit") take: number = 10) {
    return await this.subcategoriesService.getFeaturedProducts(name, skip, take);
  }

  @Public()
  @Get(":name/rating")
  async getProductsSortedByRating(@Param("name") name: string, @Query("skip") skip: number = 0, @Query("limit") limit: number = 10) {
    return await this.subcategoriesService.getProductsBasedOnRating(name, skip, limit);
  }

  @Public()
  @Get(":name/price_descending")
  async getProductsSortedByPriceDescending(@Param("name") name: string, @Query("skip") skip: number = 0, @Query("limit") limit: number = 10) {
    return await this.subcategoriesService.getProductsByPriceDesc(name, skip, limit);
  }

  @Public()
  @Get(":name/price_ascending")
  async getProductsSortedByPriceAscending(@Param("name") name: string, @Query("skip") skip: number = 0, @Query("limit") limit: number = 10) {
    return await this.subcategoriesService.getProductsByPriceAsc(name, skip, limit);
  }

  @Public()
  @Get(":name/most_wishlisted")
  async getMostWishlisted(@Param("name") name: string, @Query("skip") skip: number = 0, @Query("limit") limit: number = 10) {
    return await this.subcategoriesService.getTopWishlistedProducts(name, skip, limit);
  }

  @Public()
  @Get(":name/most_sold")
  async getMostSold(@Param("name") name: string, @Query("skip") skip: number = 0, @Query("limit") limit: number = 10) {
    return await this.subcategoriesService.getTopWishlistedProducts(name, skip, limit);
  }
}
