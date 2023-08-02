import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { GetCurrentUserId } from "src/common/decorators";
import { AtGuard } from "src/common/guards";
import { CreateReviewDto } from "./dtos/create-review.dto";

@Controller("products")
export class ProductsController {
  q;
  constructor(private productsService: ProductsService) {}

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

  @Get("most_wishlisted")
  async getMostWishlisted() {
    return await this.productsService.getTopWishlisted();
  }

  @Get("most_sold")
  async getMostSold() {
    return await this.productsService.getTopSelling();
  }

  @Get(":subcategoryId/most_wishlisted")
  async getMostWishlistedBySubcategory(
    @Param("subcategoryId") subcategoryId: string,
  ) {
    return await this.productsService.getTopSellingBySubcategory(
      parseInt(subcategoryId),
    );
  }

  @Get(":subcategoryId/most_sold")
  async getMostSoldBySubcategory(
    @Param("subcategoryId") subcategoryId: string,
  ) {
    return await this.productsService.getTopWishlistedBySubcategory(
      parseInt(subcategoryId),
    );
  }
}
