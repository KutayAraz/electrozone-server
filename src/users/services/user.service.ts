import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { User } from "src/entities/User.entity";
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

  async deleteUser(userUuid: string): Promise<User> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await this.findByUuid(userUuid);
      const deletedUser = await transactionalEntityManager.remove(User, user);

      // Invalidate user caches after deletion
      await this.invalidateUserCaches(userUuid);

      return deletedUser;
    });
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
