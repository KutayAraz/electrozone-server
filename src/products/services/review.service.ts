import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { User } from "src/entities/User.entity";
import { DataSource, Repository } from "typeorm";
import { ProductReviewsResponse } from "../types/product-reviews-response.type";
import { TransformedReview } from "../types/transformed-review.type";
import { RatingDistribution } from "../types/rating-distribution.type";
import Decimal from "decimal.js";
import { CacheResult } from "src/common/decorators/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @InjectRepository(Product)
    @InjectRepository(Review) private readonly reviewsRepo: Repository<Review>,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService
  ) { }

  // Retrieves reviews for a specific product with pagination
  @CacheResult({
    prefix: 'product-reviews',
    ttl: 10800,
    paramKeys: ['productId', 'skip', 'limit']
  })
  async getProductReviews(
    productId: number,
    skip: number = 0,
    limit: number = 5,
  ): Promise<ProductReviewsResponse> {
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
      .orderBy("review.reviewDate", "DESC")
      .where("review.productId = :productId", { productId })
      .skip(skip)
      .take(limit)
      .getMany();

    const totalCount = await this.getTotalReviewCount(productId);

    // Get ratings distribution
    const ratingsCount = await this.getRatingsDistribution(productId);

    // Transform reviews to hide full names
    const transformedReviews: TransformedReview[] = reviews.map((review) => ({
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
    prefix: 'review-count',
    ttl: 10800,
    paramKeys: ['productId']
  })
  private async getTotalReviewCount(productId: number): Promise<number> {
    return await this.reviewsRepo.count({
      where: { product: { id: productId } },
    });
  }

  @CacheResult({
    prefix: 'ratings-distribution',
    ttl: 10800,
    paramKeys: ['productId']
  })
  private async getRatingsDistribution(
    productId: number,
  ): Promise<RatingDistribution[]> {
    const ratingsCountRaw = await this.reviewsRepo
      .createQueryBuilder("review")
      .select("review.rating", "rating")
      .addSelect("COUNT(*)", "count")
      .where("review.productId = :productId", { productId })
      .groupBy("review.rating")
      .getRawMany();

    const ratingsCount = [];
    for (let i = 5; i >= 1; i--) {
      const ratingEntry = ratingsCountRaw.find(
        (rc) => parseInt(rc.rating) === i,
      );
      ratingsCount.push({
        review_rating: i,
        count: ratingEntry ? ratingEntry.count : "0",
      });
    }

    return ratingsCount;
  }

  async checkReviewEligibility(
    selectedProductId: number,
    userUuid: string,
  ): Promise<boolean> {
    const cacheKey = this.redisService.generateKey('review-eligibility', {
      productId: selectedProductId,
      userUuid
    });

    // Try to get from cache first
    const cachedResult = await this.redisService.get<boolean>(cacheKey);
    if (cachedResult !== null) {
      return cachedResult;
    }

    // Check if the user has ordered the product
    const hasOrderedProduct = await this.ordersRepo
      .createQueryBuilder("order")
      .innerJoin("order.user", "user")
      .innerJoin("order.orderItems", "orderItem")
      .innerJoin("orderItem.product", "product")
      .where("user.uuid = :userUuid", { userUuid })
      .andWhere("orderItem.product.id = :productId", {
        productId: selectedProductId,
      })
      .select("orderItem.product.id", "productId")
      .getRawOne();

    if (!hasOrderedProduct) {
      return false;
    }

    // Check if the user has already reviewed the product
    const existingReview = await this.reviewsRepo.findOne({
      where: {
        product: { id: selectedProductId },
        user: { uuid: userUuid },
      },
    });

    const isEligible = !existingReview;
    await this.redisService.set(cacheKey, isEligible, 10800);
    return isEligible;
  }

  async addReview(
    productId: number,
    userUuid: string,
    rating: string,
    comment: string,
  ): Promise<string> {
    const canReview = await this.checkReviewEligibility(productId, userUuid);
    if (!canReview) {
      throw new AppError(
        ErrorType.INELIGABLE_REVIEW,
        "You are not eligible to review this product",
      );
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const [product, user] = await Promise.all([
        transactionalEntityManager.findOneOrFail(Product, {
          where: { id: productId },
          relations: ["reviews"],
        }),
        transactionalEntityManager.findOneByOrFail(User, { uuid: userUuid }),
      ]);

      const review = transactionalEntityManager.create(Review, {
        product,
        user,
        rating,
        comment,
      });

      await transactionalEntityManager.save(review);

      // Update product's average rating
      product.reviews.push(review);
      const ratingTotal = product.reviews.reduce(
        (total, rev) => total.plus(new Decimal(rev.rating)),
        new Decimal(0),
      );
      product.averageRating = ratingTotal
        .div(product.reviews.length)
        .toFixed(2);

      await transactionalEntityManager.save(product);

      // Invalidate related caches
      await this.invalidateProductReviewCaches(productId, userUuid);

      return product.averageRating;
    });
  }

  private async invalidateProductReviewCaches(productId: number, userUuid: string): Promise<void> {
    try {
      const keysToInvalidate = [
        this.redisService.generateKey('product-reviews', { productId, skip: 0, limit: 5 }), // Default page
        this.redisService.generateKey('review-count', { productId }),
        this.redisService.generateKey('ratings-distribution', { productId }),
        this.redisService.generateKey('review-eligibility', { productId, userUuid })
      ];

      await Promise.all(keysToInvalidate.map(key => this.redisService.del(key)));
      this.logger.debug(`Invalidated cache keys for product ${productId}`);
    } catch (error) {
      this.logger.error('Failed to invalidate review caches:', error);
    }
  }
}
