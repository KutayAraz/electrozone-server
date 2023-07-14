import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Review } from "src/entities/Review.entity";
import { Repository } from "typeorm";
import { CreateReviewDto } from "./dtos/create-review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviewRepo: Repository<Review>,
  ) {}

  create(reviewDto: CreateReviewDto) {
    const review = this.reviewRepo.create(reviewDto);

    return this.reviewRepo.save(review);
  }
}
