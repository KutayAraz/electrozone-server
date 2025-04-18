import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
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
  async getProductReviews(@Param("productId") productId: string): Promise<ProductReviewsResponse> {
    return await this.reviewService.getProductReviews(parseInt(productId));
  }

  @Get(":productId/eligibility")
  async checkReviewEligibility(
    @UserUuid() userUuid: string,
    @Param("productId") productId: string,
  ): Promise<boolean> {
    return await this.reviewService.checkReviewEligibility(parseInt(productId), userUuid);
  }

  @Post(":productId")
  async createReview(
    @Body() createReviewDto: CreateReviewDto,
    @UserUuid() userUuid: string,
    @Param("productId") productId: number,
  ): Promise<string> {
    return await this.reviewService.addReview(
      productId,
      userUuid,
      createReviewDto.rating.toString(),
      createReviewDto.comment,
    );
  }
}
