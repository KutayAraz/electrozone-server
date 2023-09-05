import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { GetCurrentUserId, Public } from "src/common/decorators";
import { AtGuard } from "src/common/guards";

@Controller("products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Public()
  @Get("/most-wishlisted")
  async getMostWishlisted() {
    return await this.productsService.getTopWishlisted();
  }

  @Public()
  @Get("most-sold")
  async getMostSold() {
    return await this.productsService.getTopSelling();
  }

  @Public()
  @Get("best-rated")
  async getBestRated() {
    return await this.productsService.getBestRated();
  }

  @Public()
  @Get(":id")
  async getProduct(@Param("id", ParseIntPipe) id: number) {
    return await this.productsService.findProduct(id);
  }

  @UseGuards(AtGuard)
  @Get(":productId/wishlist")
  async checkWishlist(
    @Param("productId") productId: string,
    @GetCurrentUserId() userId: number,
  ) {
    return await this.productsService.checkWishlist(
      parseInt(productId),
      userId,
    );
  }

  @UseGuards(AtGuard)
  @Patch(":productId/wishlist")
  async toggleWishlist(
    @Param("productId") productId: string,
    @GetCurrentUserId() userId: number,
  ) {
    return await this.productsService.toggleWishlist(
      parseInt(productId),
      userId,
    );
  }

  @Public()
  @Get()
  async getProductsBySearch(@Query("search") encodedSearchQuery: string) {
    const searchQuery = decodeURIComponent(encodedSearchQuery);
    return this.productsService.findBySearch(searchQuery);
  }
}
