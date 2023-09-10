import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { Public, GetCurrentUserId } from "src/common/decorators";
import { AtGuard } from "src/common/guards";
import { CreateReviewDto } from "./dtos/create-review.dto";

@Controller("reviews")
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Public()
  @Get(":productId/reviews")
  async getProductReviews(@Param("productId") productId: string) {
    return await this.reviewsService.getReviewsByProductId(parseInt(productId));
  }

  @Get(":productId/canReview")
  @UseGuards(AtGuard)
  async checkCanReview(
    @GetCurrentUserId() userId: number,
    @Param("productId") productId: string,
  ) {
    return await this.reviewsService.canCurrentUserReview(
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
    return this.reviewsService.addReview(
      parseInt(productId),
      userId,
      createReviewDto.rating,
      createReviewDto.comment,
    );
  }
}
