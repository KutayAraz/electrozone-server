import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
  Query
} from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { Public, GetCurrentUserId } from "src/common/decorators";
import { AtGuard } from "src/common/guards";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { Response } from "express";

@Controller("reviews")
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) { }

  @Public()
  @Get(":productId/reviews")
  async getProductReviews(
    @Param("productId") productId: string,
  ) {
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
  async createReview(
    @Body() createReviewDto: CreateReviewDto,
    @GetCurrentUserId() userId: number,
    @Param("productId") productId: string,
    @Res() response: Response,
  ) {
    try {
      const newRating = await this.reviewsService.addReview(
        parseInt(productId),
        userId,
        createReviewDto.rating,
        createReviewDto.comment,
      );
      return response.status(HttpStatus.OK).json({
        message: "Review added successfully",
        newRating: newRating,
      });
    } catch (error) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        message: "An error occurred while adding your review.",
        error: error.message,
      });
    }
  }
}
