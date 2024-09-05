import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/entities/User.entity";
import { Repository } from "typeorm";
import { UpdateUserDto } from "../dtos/update-user.dto";
import { Wishlist } from "src/entities/Wishlist.entity";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Wishlist) private readonly wishlistsRepo: Repository<Wishlist>,
  ) { }

  async findByUuid(uuid: string): Promise<User> {
    if (!uuid) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'Access Denied', HttpStatus.FORBIDDEN);
    }
    const user = await this.usersRepo.findOne({ where: { uuid } });

    if (!user) {
      throw new AppError(ErrorType.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    return user;
  }

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

  async updateUserProfile(uuid: string, updatedUserData: UpdateUserDto): Promise<Partial<User>> {
    const user = await this.findByUuid(uuid);

    const { password, ...otherFields } = updatedUserData;
    Object.assign(user, otherFields);

    await this.usersRepo.save(user);

    return {
      email: user.email,
      address: user.address,
      city: user.city,
    };
  }

  async getUserWishlist(uuid: string): Promise<Array<{
    id: number;
    productName: string;
    brand: string;
    thumbnail: string;
    price: number;
    stock: number;
    subcategory: string;
    category: string;
  }>> {
    const user = await this.findByUuid(uuid);
    const wishlists = await this.wishlistsRepo.find({
      where: { user: { id: user.id } },
      relations: [
        "product",
        "product.subcategory",
        "product.subcategory.category",
      ],
    });

    return wishlists.map((wishlist) => {
      const product = wishlist.product;
      return {
        id: product.id,
        productName: product.productName,
        brand: product.brand,
        thumbnail: product.thumbnail,
        price: product.price,
        stock: product.stock,
        subcategory: product.subcategory.subcategory,
        category: product.subcategory.category.category,
      };
    });
  }

  async deleteUser(uuid: string): Promise<User> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await this.findByUuid(uuid);
      return await transactionalEntityManager.remove(User, user);
    });
  }
}
