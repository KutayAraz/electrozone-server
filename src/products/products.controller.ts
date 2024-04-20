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
  constructor(private productsService: ProductsService) { }

  @Public()
  @Get("/most-wishlisted")
  async getMostWishlisted() {
    return await this.productsService.getTopWishlisted();
  }

  @Public()
  @Get("best-sellers")
  async getMostSold() {
    return await this.productsService.getTopSelling();
  }

  @Public()
  @Get("top-rated")
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
  async getProductsBySearch(
    @Query("query") encodedSearchQuery: string,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,
    @Query("sort") sort: string = "relevance",
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPrice: number = 0,
    @Query("max_price") maxPrice?: number,
    @Query("brands") brandString?: string,
    @Query("subcategories") subcategoriesString?: string,
  ) {
    const searchQuery = decodeURIComponent(encodedSearchQuery);
    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;
    const subcategories = subcategoriesString ? subcategoriesString.split(' ').map(decodeURIComponent) : undefined;
    
    const priceRange = maxPrice ? { min: minPrice, max: maxPrice } : undefined;
    return this.productsService.findBySearch(
      searchQuery,
      skip,
      take,
      sort,
      stockStatus,
      priceRange,
      brands,
      subcategories);
  }
}
