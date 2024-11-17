import { RatingDistribution } from "./rating-distribution.type";
import { TransformedReview } from "./transformed-review.type";

export interface ProductReviewsResponse {
  reviews: TransformedReview[];
  ratingsDistribution: RatingDistribution[];
  totalCount: number;
  skip: number;
  limit: number;
}
