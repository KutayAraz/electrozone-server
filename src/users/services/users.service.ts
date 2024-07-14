import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/entities/User.entity";
import { Repository } from "typeorm";
import { UpdateUserDto } from "../dtos/update-user.dto";
import { Wishlist } from "src/entities/Wishlist.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Wishlist) private wishlistsRepo: Repository<Wishlist>,
  ) {}

  async find(id: number) {
    if (!id) {
      throw new BadRequestException(["No user is signed in!"]);
    }
    const user = await this.usersRepo.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(["No user with this email found!"]);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersRepo.findOne({
      where: {
        email,
      },
    });

    if (!user) {
      throw new NotFoundException(["No user with this email found!"]);
    }

    const {
      password: excludedPassword,
      hashedRt: excludedRt,
      ...result
    } = user;

    return result;
  }

  async update(id: number, updatedUserData: UpdateUserDto) {
    const user = await this.find(id);

    const { password, ...otherFields } = updatedUserData;
    Object.assign(user, otherFields);

    await this.usersRepo.save(user);

    return {
      email: user.email,
      address: user.address,
      city: user.city,
    };
  }

  async getUserWishlist(userId: number) {
    const wishlists = await this.wishlistsRepo.find({
      where: { user: { id: userId } },
      relations: [
        "product",
        "product.subcategory",
        "product.subcategory.category",
      ],
    });

    const wishlistedProducts = wishlists.map((wishlist) => {
      const product = wishlist.product;
      return {
        id: product.id,
        productName: product.productName,
        brand: product.brand,
        thumbnail: product.thumbnail,
        price: product.price,
        stock: product.stock,
        subcategory: product.subcategory.subcategory,
        category: product.subcategory.category?.category,
      };
    });

    return wishlistedProducts;
  }
}
