import { Controller, Get, Param } from "@nestjs/common";
import { SubcategoriesService } from "./subcategories.service";
import { Public } from "src/common/decorators";

@Controller("subcategories")
export class SubcategoriesController {
  constructor(private subcategoriesService: SubcategoriesService) {}

  @Public()
  @Get(":name/featured")
  async getAllProducts(@Param("name") name: string) {
    return await this.subcategoriesService.findProducts(name);
  }

  @Public()
  @Get(":name/rating")
  async getProductsSortedByRating(@Param("name") name: string) {
    return await this.subcategoriesService.getProductsBasedOnRating(name);
  }

  @Public()
  @Get(":name/price_descending")
  async getProductsSortedByPriceDescending(@Param("name") name: string) {
    return await this.subcategoriesService.getProductsByPriceDesc(name);
  }

  @Public()
  @Get(":name/price_ascending")
  async getProductsSortedByPriceAscending(@Param("name") name: string) {
    return await this.subcategoriesService.getProductsByPriceAsc(name);
  }

  @Public()
  @Get(":name/most_wishlisted")
  async getMostWishlisted(@Param("name") name: string) {
    return await this.subcategoriesService.getTopWishlistedProducts(name);
  }

  @Public()
  @Get(":name/most_sold")
  async getMostSold(@Param("name") name: string) {
    return await this.subcategoriesService.getTopWishlistedProducts(name);
  }
}
