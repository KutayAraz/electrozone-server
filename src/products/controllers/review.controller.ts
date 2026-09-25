import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CreateReviewDto } from "../dtos/create-review.dto";
import { Public } from "src/common/decorators/public.decorator";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { ReviewService } from "../services/review.service";
import { ProductReviewsResponse } from "../types/product-reviews-response.type";

@Controller("review")
export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  @Public()
  @Get(":productId")
  async getProductReviews(
    @Param("productId", ParseIntPipe) productId: number,
  ): Promise<ProductReviewsResponse> {
    return await this.reviewService.getProductReviews(productId);
  }

  @Get(":productId/eligibility")
  async checkReviewEligibility(
    @UserUuid() userUuid: string,
    @Param("productId", ParseIntPipe) productId: number,
  ): Promise<boolean> {
    return await this.reviewService.checkReviewEligibility(productId, userUuid);
  }

  @Post(":productId")
  async createReview(
    @Body() createReviewDto: CreateReviewDto,
    @UserUuid() userUuid: string,
    @Param("productId", ParseIntPipe) productId: number,
  ): Promise<string> {
    return await this.reviewService.addReview(
      productId,
      userUuid,
      createReviewDto.rating.toString(),
      createReviewDto.comment,
    );
  }
}
