import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist.entity";
import {
  getProductReviewCacheKeys,
  recalculateAverageRating,
} from "src/products/helpers/review-helpers";
import { CacheResult } from "src/redis/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";
import { Repository } from "typeorm";
import { UpdateUserDto } from "../dtos/update-user.dto";

type UserProfile = Omit<User, "password" | "hashedRt" | "generateUuid" | "uuid" | "id" | "role">;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async findByUuid(userUuid: string): Promise<User> {
    if (!userUuid) {
      throw new AppError(ErrorType.ACCESS_DENIED, "Access Denied", HttpStatus.FORBIDDEN);
    }
    const user = await this.usersRepo.findOne({ where: { uuid: userUuid } });

    if (!user) {
      throw new AppError(ErrorType.USER_NOT_FOUND, "User not found", HttpStatus.NOT_FOUND);
    }

    return user;
  }

  @CacheResult({
    prefix: "user-profile",
    ttl: 86400,
    paramKeys: ["userUuid"],
  })
  async getProfile(userUuid: string): Promise<UserProfile> {
    const user = await this.findByUuid(userUuid);

    const { password, hashedRt, id, uuid, role, ...result } = user;
    return result;
  }

  async updateUserProfile(
    userUuid: string,
    updatedUserData: UpdateUserDto,
  ): Promise<Partial<User>> {
    const user = await this.findByUuid(userUuid);

    const { password, ...otherFields } = updatedUserData;
    Object.assign(user, otherFields);

    await this.usersRepo.save(user);

    // Invalidate user caches after update
    await this.invalidateUserCaches(userUuid);

    return {
      email: user.email,
      address: user.address,
      city: user.city,
    };
  }

  // Foreign keys to users do not cascade. Orders are kept as sales records, detached from the user.
  async deleteUser(userUuid: string): Promise<{ success: boolean }> {
    const user = await this.findByUuid(userUuid);
    const byUser = { user: { id: user.id } };

    const { wishlistedProductIds, reviewedProductIds } = await this.usersRepo.manager.transaction(
      async manager => {
        const cart = await manager.findOne(Cart, { where: byUser });
        if (cart) {
          await manager.delete(CartItem, { cart: { id: cart.id } });
          await manager.delete(Cart, { id: cart.id });
        }

        const wishlists = await manager.find(Wishlist, { where: byUser, relations: ["product"] });
        const wishlistedProductIds = wishlists.filter(w => w.product).map(w => w.product.id);
        for (const productId of wishlistedProductIds) {
          await manager.decrement(Product, { id: productId }, "wishlisted", 1);
        }
        await manager.delete(Wishlist, byUser);

        const reviews = await manager.find(Review, { where: byUser, relations: ["product"] });
        const reviewedProductIds = [
          ...new Set(reviews.filter(r => r.product).map(r => r.product.id)),
        ];
        await manager.delete(Review, byUser);
        for (const productId of reviewedProductIds) {
          await recalculateAverageRating(manager, productId);
        }

        await manager.update(Order, byUser, { user: null });
        await manager.delete(User, { id: user.id });

        return { wishlistedProductIds, reviewedProductIds };
      },
    );

    await this.invalidateUserCaches(userUuid);

    const affectedProductIds = [...new Set([...wishlistedProductIds, ...reviewedProductIds])];
    await Promise.all([
      ...affectedProductIds.map(productId => this.redisService.invalidateProductCache(productId)),
      ...reviewedProductIds
        .flatMap(productId => getProductReviewCacheKeys(this.redisService, productId))
        .map(key => this.redisService.del(key)),
    ]);

    return { success: true };
  }

  private async invalidateUserCaches(userUuid: string): Promise<void> {
    try {
      await this.redisService.del(this.redisService.generateKey("user-profile", { userUuid }));
      this.logger.debug(`Invalidated profile cache for user ${userUuid}`);
    } catch (error) {
      this.logger.error("Failed to invalidate user caches:", error);
    }
  }
}
