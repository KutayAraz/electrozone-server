import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist";
import { Brackets, Repository } from "typeorm";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(Review) private reviewsRepo: Repository<Review>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(Wishlist)
    private wishlistRepo: Repository<Wishlist>,
  ) {}

  async findProduct(id: number) {
    const product = await this.productsRepo.findOneBy({ id });

    const { sold, wishlisted, ...returnedProduct } = product;

    return returnedProduct;
  }

  async toggleWishlist(productId: number, userId: number) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ["wishlists"],
    });

    if (!user) {
      throw new BadRequestException("No such user found");
    }

    const product = await this.productsRepo.findOneBy({ id: productId });

    if (!product) {
      throw new BadRequestException("No such product found");
    }

    const isWishlisted = await this.wishlistRepo.find({
      where: {
        product: { id: productId },
        user: { id: userId },
      },
    });

    if (isWishlisted.length > 0) {
      product.wishlisted--;
      await this.productsRepo.save(product);
      return await this.wishlistRepo.remove(isWishlisted);
    } else {
      product.wishlisted++;
      await this.productsRepo.save(product);
      const item = new Wishlist();
      item.product = product;
      item.user = user;

      const save = this.wishlistRepo.create(item);
      return await this.wishlistRepo.save(item);
    }
  }

  async getTopSelling(take: number = 10): Promise<Product[]> {
    return this.productsRepo
      .createQueryBuilder("product")
      .orderBy("product.sold", "DESC")
      .take(take)
      .getMany();
  }

  async getTopWishlisted(take: number = 10): Promise<Product[]> {
    return this.productsRepo
      .createQueryBuilder("product")
      .orderBy("product.wishlisted", "DESC")
      .take(take)
      .getMany();
  }

  async findBySearch(search: string) {
    const searchWords = search.split(" ");

    const query = this.productsRepo.createQueryBuilder("product");

    query.where(
      new Brackets((qb) => {
        searchWords.forEach((word, index) => {
          if (index === 0) {
            qb.where(`product.productName LIKE :search${index}`, {
              [`search${index}`]: `%${word}%`,
            });
          } else {
            qb.orWhere(`product.productName LIKE :search${index}`, {
              [`search${index}`]: `%${word}%`,
            });
          }
        });
      }),
    );

    query.orWhere(`product.brand LIKE :search`, { search: `%${search}%` });

    query.orWhere(`product.description LIKE :search`, {
      search: `%${search}%`,
    });

    query.orderBy("product.productName", "ASC");

    return await query.getMany();
  }
}
