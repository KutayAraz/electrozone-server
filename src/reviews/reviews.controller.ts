import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { JwtGuard } from "src/users/guards/jwt-auth.guard";

@Controller("reviews")
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtGuard)
  createReview(@Body() body: CreateReviewDto) {
    return this.reviewsService.create(body);
  }
}
