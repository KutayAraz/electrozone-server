import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist.entity";
import { CacheResult } from "src/redis/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";
import { DataSource, Repository } from "typeorm";
import { WishlistItem } from "../types/wishlist-product.type";
import { WishlistToggleResult } from "../types/wishlist-toggle-result.type";

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @CacheResult({
    prefix: "wishlist-user",
    ttl: 10800,
    paramKeys: ["userUuid"],
  })
  async getUserWishlist(userUuid: string): Promise<WishlistItem[]> {
    // Fetch wishlist items with related product, subcategory, and category information
    const userWishlist = await this.wishlistRepo
      .createQueryBuilder("wishlist")
      .innerJoin("wishlist.user", "user")
      .innerJoin("wishlist.product", "product")
      .innerJoin("product.subcategory", "subcategory")
      .innerJoin("subcategory.category", "category")
      .where("user.uuid = :userUuid", { userUuid })
      .select([
        // Select specific fields to avoid overfetching
        "product.id",
        "product.productName",
        "product.brand",
        "product.averageRating",
        "product.thumbnail",
        "product.price",
        "product.stock",
        "subcategory.subcategory",
        "category.category",
      ])
      .getRawMany();

    console.log("user Wishlist", userWishlist);

    // Map the raw query result to the WishlistItem type
    return userWishlist.map(wishlist => {
      return {
        id: wishlist.product_id,
        productName: wishlist.product_productName,
        brand: wishlist.product_brand,
        averageRating: wishlist.product_averageRating,
        thumbnail: wishlist.product_thumbnail,
        price: wishlist.product_price,
        stock: wishlist.product_stock,
        subcategory: wishlist.subcategory_subcategory,
        category: wishlist.category_category,
      };
    });
  }

  @CacheResult({
    prefix: "wishlist-check",
    ttl: 10800,
    paramKeys: ["productId", "userUuid"],
  })
  async checkWishlist(productId: number, userUuid: string): Promise<boolean> {
    // Check if a product is in the user's wishlist
    const count = await this.wishlistRepo.count({
      where: {
        product: { id: productId },
        user: { uuid: userUuid },
      },
    });

    return count > 0;
  }

  async toggleWishlist(productId: number, userUuid: string): Promise<WishlistToggleResult> {
    return this.dataSource.transaction(async transactionalEntityManager => {
      // Fetch user and product concurrently for efficiency
      const [user, product] = await Promise.all([
        transactionalEntityManager.findOne(User, {
          where: { uuid: userUuid },
          select: ["id"],
        }),
        transactionalEntityManager.findOne(Product, {
          where: { id: productId },
          select: ["id", "wishlisted"],
        }),
      ]);

      if (!product) {
        throw new AppError(ErrorType.PRODUCT_NOT_FOUND, "Product not found");
      }

      // Check if the product is already in the wishlist
      const wishlistProduct = await transactionalEntityManager.findOne(Wishlist, {
        where: {
          product: { id: productId },
          user: { uuid: userUuid },
        },
      });

      let action: "added" | "removed";

      if (wishlistProduct) {
        // Remove from wishlist if it exists
        product.wishlisted--;
        await transactionalEntityManager.remove(wishlistProduct);
        action = "removed";
      } else {
        // Add to wishlist if it doesn't exist
        product.wishlisted++;
        const newWishlistProduct = transactionalEntityManager.create(Wishlist, {
          product,
          user,
        });
        await transactionalEntityManager.save(newWishlistProduct);
        action = "added";
      }

      // Update the product's wishlisted count
      await transactionalEntityManager.save(product);

      await this.invalidateWishlistCaches(userUuid, productId);

      return {
        action,
        productId,
      };
    });
  }

  private async invalidateWishlistCaches(userUuid: string, productId?: number): Promise<void> {
    try {
      const cacheKeys = [this.redisService.generateKey("wishlist-user", { userUuid })];

      // If productId is provided, also invalidate the specific check cache
      if (productId) {
        cacheKeys.push(this.redisService.generateKey("wishlist-check", { productId, userUuid }));
      }

      await Promise.all(cacheKeys.map(key => this.redisService.del(key)));
      this.logger.debug(`Invalidated wishlist cache keys for user ${userUuid}`);
    } catch (error) {
      this.logger.error("Failed to invalidate wishlist caches:", error);
    }
  }
}
