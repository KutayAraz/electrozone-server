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
    const product = await this.productsRepo.findOne({
      where: { id },
      relations: [
        "productImages",
        "subcategory",
        "subcategory.category",
        "reviews",
      ],
    });

    const { sold, wishlisted, subcategory, ...returnedProduct } = product;

    return {
      ...returnedProduct,
      subcategory: subcategory.subcategory,
      category: subcategory.category.category,
    };
  }

  async checkWishlist(productId: number, userId: number) {
    const isWishlisted = await this.wishlistRepo.find({
      where: {
        product: { id: productId },
        user: { id: userId },
      },
    });

    return isWishlisted.length > 0;
  }

  async toggleWishlist(productId: number, userId: number) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ["id"],
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

    let action: string;

    if (isWishlisted.length > 0) {
      product.wishlisted--;
      await this.productsRepo.save(product);
      await this.wishlistRepo.remove(isWishlisted);
      action = "removed";
    } else {
      product.wishlisted++;
      await this.productsRepo.save(product);
      const item = new Wishlist();
      item.product = product;
      item.user = user;
      await this.wishlistRepo.save(item);
      action = "added";
    }
    return {
      status: "success",
      action: action,
      productId: productId,
    };
  }

  async getTopSelling(take: number = 10): Promise<any[]> {
    const rawData = await this.productsRepo
      .createQueryBuilder("product")
      .select([
        "product.id",
        "product.productName",
        "product.thumbnail",
        "product.sold",
      ])
      .leftJoin("product.subcategory", "subcategory")
      .addSelect(["subcategory.subcategory"])
      .leftJoin("subcategory.category", "category")
      .addSelect(["category.category"])
      .orderBy("product.sold", "DESC")
      .take(take)
      .getMany();

    return rawData.map((row) => ({
      id: row.id,
      productName: row.productName,
      thumbnail: row.thumbnail,
      subcategory: row.subcategory.subcategory,
      category: row.subcategory.category.category,
    }));
  }

  async getTopWishlisted(take: number = 10): Promise<any[]> {
    const rawData = await this.productsRepo
      .createQueryBuilder("product")
      .select([
        "product.id",
        "product.productName",
        "product.thumbnail",
        "product.wishlisted",
      ])
      .leftJoin("product.subcategory", "subcategory")
      .addSelect(["subcategory.subcategory"])
      .leftJoin("subcategory.category", "category")
      .addSelect(["category.category"])
      .orderBy("product.wishlisted", "DESC")
      .take(take)
      .getMany();

    return rawData.map((row) => ({
      id: row.id,
      productName: row.productName,
      thumbnail: row.thumbnail,
      subcategory: row.subcategory.subcategory,
      category: row.subcategory.category.category,
    }));
  }

  async getBestRated(take: number = 10): Promise<any[]> {
    const rawData = await this.productsRepo
      .createQueryBuilder("product")
      .select([
        "product.id",
        "product.productName",
        "product.thumbnail",
        "product.averageRating",
      ])
      .leftJoin("product.subcategory", "subcategory")
      .addSelect(["subcategory.subcategory"])
      .leftJoin("subcategory.category", "category")
      .addSelect(["category.category"])
      .orderBy("product.averageRating", "DESC")
      .take(take)
      .getMany();

    return rawData.map((row) => ({
      id: row.id,
      productName: row.productName,
      thumbnail: row.thumbnail,
      subcategory: row.subcategory.subcategory,
      category: row.subcategory.category.category,
    }));
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
