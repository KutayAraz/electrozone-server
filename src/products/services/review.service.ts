import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { User } from "src/entities/User.entity";
import { CacheResult } from "src/redis/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";
import { DataSource, EntityManager, Repository } from "typeorm";
import { getProductReviewCacheKeys, recalculateAverageRating } from "../helpers/review-helpers";
import { ProductReviewsResponse } from "../types/product-reviews-response.type";
import { RatingDistribution } from "../types/rating-distribution.type";
import { TransformedReview } from "../types/transformed-review.type";

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @InjectRepository(Review) private readonly reviewsRepo: Repository<Review>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  // Retrieves reviews for a specific product with pagination
  @CacheResult({
    prefix: "review-product",
    ttl: 10800,
    paramKeys: ["productId", "skip", "limit"],
  })
  async getProductReviews(productId: number, skip = 0, limit = 5): Promise<ProductReviewsResponse> {
    const reviews = await this.reviewsRepo
      .createQueryBuilder("review")
      .select([
        "review.id",
        "review.reviewDate",
        "review.rating",
        "review.comment",
        "user.firstName",
        "user.lastName",
      ])
      .innerJoin("review.user", "user")
      // reviewDate alone is not unique, so paginating on it can repeat or skip
      // reviews. Newest id first keeps the tie-break consistent with the sort.
      .orderBy("review.reviewDate", "DESC")
      .addOrderBy("review.id", "DESC")
      .where("review.product = :productId", { productId })
      .skip(skip)
      .take(limit)
      .getMany();

    const totalCount = await this.getTotalReviewCount(productId);

    // Get ratings distribution
    const ratingsCount = await this.getRatingsDistribution(productId);

    // Transform reviews to hide full names
    const transformedReviews: TransformedReview[] = reviews.map(review => ({
      id: review.id,
      reviewDate: review.reviewDate,
      rating: review.rating,
      comment: review.comment,
      user: {
        firstName: `${review.user.firstName.charAt(0)}.`,
        lastName: `${review.user.lastName.charAt(0)}.`,
      },
    }));

    return {
      reviews: transformedReviews,
      ratingsDistribution: ratingsCount,
      totalCount: totalCount,
      skip: skip,
      limit: limit,
    };
  }

  @CacheResult({
    prefix: "review-count",
    ttl: 10800,
    paramKeys: ["productId"],
  })
  private async getTotalReviewCount(productId: number): Promise<number> {
    return await this.reviewsRepo.count({
      where: { product: { id: productId } },
    });
  }

  @CacheResult({
    prefix: "review-product-ratings",
    ttl: 10800,
    paramKeys: ["productId"],
  })
  private async getRatingsDistribution(productId: number): Promise<RatingDistribution[]> {
    const ratingsCountRaw = await this.reviewsRepo
      .createQueryBuilder("review")
      .select("review.rating", "rating")
      .addSelect("COUNT(*)", "count")
      .where("review.productId = :productId", { productId })
      .groupBy("review.rating")
      .getRawMany();

    const ratingsCount = [];
    for (let i = 5; i >= 1; i--) {
      const ratingEntry = ratingsCountRaw.find(rc => parseInt(rc.rating) === i);
      ratingsCount.push({
        review_rating: i,
        count: ratingEntry ? ratingEntry.count : "0",
      });
    }

    return ratingsCount;
  }

  @CacheResult({
    prefix: "review-eligibility",
    ttl: 1800,
    paramKeys: ["productId", "userUuid"],
  })
  async checkReviewEligibility(productId: number, userUuid: string): Promise<boolean> {
    return this.isEligibleToReview(productId, userUuid, this.dataSource.manager);
  }

  private async isEligibleToReview(
    productId: number,
    userUuid: string,
    manager: EntityManager,
  ): Promise<boolean> {
    // Check if the user has ordered the product
    const hasOrderedProduct = await manager
      .createQueryBuilder(Order, "order")
      .innerJoin("order.user", "user")
      .innerJoin("order.orderItems", "orderItem")
      .innerJoin("orderItem.product", "product")
      .where("user.uuid = :userUuid", { userUuid })
      .andWhere("orderItem.product.id = :productId", {
        productId,
      })
      .select("orderItem.product.id", "productId")
      .getRawOne();

    if (!hasOrderedProduct) {
      return false;
    }

    // Check if the user has already reviewed the product
    const existingReview = await manager.findOne(Review, {
      where: {
        product: { id: productId },
        user: { uuid: userUuid },
      },
    });

    return !existingReview;
  }

  async addReview(
    productId: number,
    userUuid: string,
    rating: string,
    comment: string,
  ): Promise<string> {
    const averageRating = await this.dataSource.transaction(async transactionalEntityManager => {
      const canReview = await this.isEligibleToReview(
        productId,
        userUuid,
        transactionalEntityManager,
      );

      if (!canReview) {
        throw new AppError(
          ErrorType.INELIGABLE_REVIEW,
          "You are not eligible to review this product",
        );
      }

      const [product, user] = await Promise.all([
        transactionalEntityManager.findOneBy(Product, { id: productId }),
        transactionalEntityManager.findOneBy(User, { uuid: userUuid }),
      ]);

      if (!product) {
        throw new AppError(ErrorType.PRODUCT_NOT_FOUND, "Product not found");
      }

      if (!user) {
        throw new AppError(ErrorType.USER_NOT_FOUND, "User not found");
      }

      const review = transactionalEntityManager.create(Review, {
        product,
        user,
        rating,
        comment,
      });

      await transactionalEntityManager.save(review);

      return recalculateAverageRating(transactionalEntityManager, productId);
    });

    await Promise.all([
      ...getProductReviewCacheKeys(this.redisService, productId).map(key =>
        this.redisService.del(key),
      ),
      this.redisService.invalidateProductCache(productId),
      this.invalidateReviewEligibilityCache(userUuid, [productId]),
    ]);

    return averageRating;
  }

  async invalidateReviewEligibilityCache(userUuid: string, productIds: number[]): Promise<void> {
    try {
      // Invalidate review eligibility cache for each product the user just ordered
      const cacheKeys = productIds.map(productId =>
        this.redisService.generateKey("review-eligibility", { productId, userUuid }),
      );

      await Promise.all(cacheKeys.map(key => this.redisService.del(key)));

      this.logger.debug(
        `Invalidated review eligibility cache for user ${userUuid} and ${productIds.length} products`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate review eligibility cache for user ${userUuid}:`,
        error,
      );
    }
  }
}
