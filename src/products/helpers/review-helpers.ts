import Decimal from "decimal.js";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { RedisService } from "src/redis/redis.service";
import { EntityManager } from "typeorm";

export async function recalculateAverageRating(
  manager: EntityManager,
  productId: number,
): Promise<string | null> {
  const { average } = await manager
    .createQueryBuilder(Review, "review")
    .select("AVG(CAST(review.rating AS DECIMAL(4,2)))", "average")
    .where("review.productId = :productId", { productId })
    .getRawOne();

  // One decimal: averageRating is varchar(3)
  const averageRating = average === null ? null : new Decimal(average).toFixed(1);

  await manager.update(Product, { id: productId }, { averageRating });

  return averageRating;
}

// Must match the keys @CacheResult generates in ReviewService
export function getProductReviewCacheKeys(redis: RedisService, productId: number): string[] {
  return [
    redis.generateKey("review-product", { productId }),
    redis.generateKey("review-count", { productId }),
    redis.generateKey("review-product-ratings", { productId }),
  ];
}
