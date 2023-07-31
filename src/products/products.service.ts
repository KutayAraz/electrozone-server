import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { User } from "src/entities/User.entity";
import { UserWishlist } from "src/entities/UserWishlist.entity";
import { Repository } from "typeorm";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(Review) private reviewsRepo: Repository<Review>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(UserWishlist)
    private wishlistRepo: Repository<UserWishlist>,
  ) {}

  async findProduct(id: number) {
    const product = await this.productsRepo.findOneBy({ id });

    const { sold, wishlisted, ...returnedProduct } = product;

    return returnedProduct;
  }

  async toggleWishlist(productId: number, userId: number) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ["wishlist"],
    });

    if (!user) {
      throw new BadRequestException("No such user found");
    }

    const product = await this.productsRepo.findOneBy({ id: productId });

    if (!product) {
      throw new BadRequestException("No such product found");
    }

    console.log(user.wishlist);

    const isWishlisted = user.wishlist.find((p) => p.id === productId);

    if (isWishlisted) {
      // Remove from wishlist
      user.wishlist = user.wishlist.filter((p) => p.id !== productId);
    } else {
      // Add to wishlist
      user.wishlist.push(product);
    }

    await this.usersRepo.save(user);

    return {
      message: `Product ${isWishlisted ? "removed from" : "added to"} wishlist`,
    };
  }

  async canCurrentUserReview(productId: number, userId: number) {}

  async addReview(
    productId: number,
    userId: number,
    rating: number,
    comment: string,
  ): Promise<void> {
    const product = await this.productsRepo.findOneByOrFail({ id: 1 });
    const user = await this.usersRepo.findOne({
      where: { id: 6 },
      relations: ["orders.orderItems"],
    });

    const orderItems = user.orders.flatMap((order) => order.orderItems);
    console.log(orderItems);
    console.log(orderItems.map((item) => item.product));
    const hasOrderedProduct = orderItems.some(
      (orderItem) => orderItem.product.id === productId,
    );

    console.log(hasOrderedProduct + "has ordered");
    if (!hasOrderedProduct) {
      throw new Error(
        "Cannot add review for a product that has not been ordered.",
      );
    }
    const existingReview = await this.reviewsRepo
      .createQueryBuilder("review")
      .leftJoinAndSelect("review.product", "product")
      .leftJoinAndSelect("review.user", "user")
      .where("product.id = :productId", { productId })
      .andWhere("user.id = :userId", { userId })
      .getOne();

    console.log(existingReview + "exist");
    if (existingReview) {
      throw new Error("Cannot add more than one review per product.");
    }
    const review = new Review();
    review.product = product;
    review.user = user;
    review.rating = rating;
    review.comment = comment;
    await this.reviewsRepo.save(review);
  }

  async getMostSold() {}

  async getMostWishlisted() {}

  async getMostSoldOfSubcategory() {}

  async getMostWishlistedOfSubcategoryy() {}
}
