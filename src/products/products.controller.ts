import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { GetCurrentUserId, Public } from "src/common/decorators";
import { AtGuard } from "src/common/guards";
import { CreateReviewDto } from "./dtos/create-review.dto";

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
  async getMostSold(@Param("id") id: string) {
    return await this.productsService.getTopSelling();
  }

  @Public()
  @Get(":id")
  async getProduct(@Param("id", ParseIntPipe) id: number) {
    return await this.productsService.findProduct(id);
  }

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
  @Get(":productId/reviews")
  async getProductReviews(@Param("productId") productId: string) {
    return await this.productsService.getReviewsByProductId(
      parseInt(productId),
    );
  }

  @Get(":productId/review")
  @UseGuards(AtGuard)
  async checkCanReview(
    @GetCurrentUserId() userId: number,
    @Param("productId") productId: string,
  ) {
    return await this.productsService.canCurrentUserReview(
      parseInt(productId),
      userId,
    );
  }

  @Post(":productId/review")
  @UseGuards(AtGuard)
  createReview(
    @Body() createReviewDto: CreateReviewDto,
    @GetCurrentUserId() userId: number,
    @Param("productId") productId: string,
  ) {
    return this.productsService.addReview(
      parseInt(productId),
      userId,
      createReviewDto.rating,
      createReviewDto.comment,
    );
  }

  @Public()
  @Get()
  async getProductsBySearch(@Query("search") encodedSearchQuery: string) {
    const searchQuery = decodeURIComponent(encodedSearchQuery);
    console.log(searchQuery);
    return this.productsService.findBySearch(searchQuery);
  }
}
