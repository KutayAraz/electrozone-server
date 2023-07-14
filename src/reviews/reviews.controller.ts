import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { AuthGuard } from "src/guards/auth.guard";

@Controller("reviews")
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(AuthGuard)
  createReview(@Body() body: CreateReviewDto) {
    return this.reviewsService.create(body);
  }
}
