import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/entities/User.entity";
import { Repository } from "typeorm";
import { UpdateUserDto } from "../dtos/update-user.dto";
import { Wishlist } from "src/entities/Wishlist.entity";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CacheResult } from "src/redis/cache-result.decorator";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Wishlist) private readonly wishlistsRepo: Repository<Wishlist>,
  ) { }

  @CacheResult({
    prefix: 'user-uuid',
    ttl: 96400,
    paramKeys: ['userUuid']
  })
  async findByUuid(userUuid: string): Promise<User> {
    if (!userUuid) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'Access Denied', HttpStatus.FORBIDDEN);
    }
    const user = await this.usersRepo.findOne({ where: { uuid: userUuid } });

    if (!user) {
      throw new AppError(ErrorType.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    return user;
  }

  @CacheResult({
    prefix: 'user-email',
    ttl: 96400,
    paramKeys: ['email']
  })
  async findByEmail(email: string): Promise<Omit<User, 'password' | 'hashedRt' | 'generateUuid' | 'uuid' | 'id'>> {
    const user = await this.usersRepo.findOne({
      where: { email },
    });

    if (!user) {
      throw new AppError(ErrorType.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    const { password, hashedRt, id, uuid, ...result } = user;
    return result;
  }

  async updateUserProfile(userUuid: string, updatedUserData: UpdateUserDto): Promise<Partial<User>> {
    const user = await this.findByUuid(userUuid);

    const { password, ...otherFields } = updatedUserData;
    Object.assign(user, otherFields);

    await this.usersRepo.save(user);

    return {
      email: user.email,
      address: user.address,
      city: user.city,
    };
  }

  async deleteUser(userUuid: string): Promise<User> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await this.findByUuid(userUuid);
      return await transactionalEntityManager.remove(User, user);
    });
  }
}
