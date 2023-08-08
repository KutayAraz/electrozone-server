import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist";
import { Repository } from "typeorm";
import { CreateProductDto } from "./dtos/create-product.dto";
import { Subcategory } from "src/entities/Subcategory.entity";
import { OpensearchClient } from "nestjs-opensearch";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(Review) private reviewsRepo: Repository<Review>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(Subcategory)
    private subcategoriesRepo: Repository<Subcategory>,
    @InjectRepository(Wishlist)
    private wishlistRepo: Repository<Wishlist>,
    private opensearchServiceMod: OpensearchClient,
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

  async canCurrentUserReview(selectedProductId: number, userId: number) {
    const orders = await this.ordersRepo
      .createQueryBuilder("order")
      .innerJoin("order.orderItems", "orderItem")
      .where("order.user.id = :userId", { userId })
      .select("orderItem.product.id", "productId")
      .getRawMany();

    const hasOrderedProduct = orders.some(
      ({ productId }) => productId === selectedProductId,
    );

    if (!hasOrderedProduct) {
      return new BadRequestException(
        "You cannot review a product you have not purchased",
      );
    }

    const reviews = await this.reviewsRepo.find({
      where: {
        product: { id: selectedProductId },
        user: { id: userId },
      },
    });

    if (reviews.length > 0) {
      throw new BadRequestException(
        "You cannot review a product you have already reviewed",
      );
    } else {
      return true;
    }
  }

  async addReview(
    productId: number,
    userId: number,
    rating: number,
    comment: string,
  ): Promise<any> {
    const product = await this.productsRepo.findOneOrFail({
      where: { id: productId },
      relations: ["reviews"],
    });
    const user = await this.usersRepo.findOneByOrFail({ id: userId });

    if (!(await this.canCurrentUserReview(productId, userId))) {
      throw new Error("Cannot add more than one review per product.");
    }
    const review = new Review();
    review.product = product;
    review.user = user;
    review.rating = rating;
    review.comment = comment;
    await this.productsRepo.save(product);
    await this.reviewsRepo.save(review);

    const updatedProduct = await this.productsRepo.findOneOrFail({
      where: { id: productId },
      relations: ["reviews"],
    });

    const ratingTotal = updatedProduct.reviews.reduce((total, review) => {
      return total + review.rating;
    }, 0);

    const newRating = ratingTotal / updatedProduct.reviews.length;

    updatedProduct.averageRating = newRating;
    await this.productsRepo.save(updatedProduct);

    return `New rating after the review is ${newRating}`;
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

  async getTopSellingBySubcategory(
    subcategoryId: number,
    take: number = 5,
  ): Promise<Product[]> {
    return this.productsRepo
      .createQueryBuilder("product")
      .where("product.subcategoryId = :subcatId", { subcatId: subcategoryId })
      .orderBy("product.sold", "DESC")
      .take(take)
      .getMany();
  }

  async getTopWishlistedBySubcategory(
    subcategoryId: number,
    take: number = 5,
  ): Promise<Product[]> {
    return this.productsRepo
      .createQueryBuilder("product")
      .where("product.subcategoryId = :subcatId", { subcatId: subcategoryId })
      .orderBy("product.wishlisted", "DESC")
      .take(take)
      .getMany();
  }

  async searchProducts(query: string) {
    const result = await this.opensearchServiceMod.search({
      index: "products",
      body: {
        query: {
          bool: {
            should: [
              {
                wildcard: {
                  productName: {
                    value: `${query}*`,
                    boost: 5, // Higher boost for productName
                  },
                },
              },
              {
                wildcard: {
                  brand: {
                    value: `${query}*`,
                    boost: 3, // Medium boost for brand
                  },
                },
              },
              {
                wildcard: {
                  description: {
                    value: `${query}*`,
                    boost: 1, // Lowest boost for description
                  },
                },
              },
            ],
          },
        },
      },
    });

    const hits = result.body.hits.hits;

    return hits.map((hit) => hit._source);
  }

  async indexProduct(product: Product) {
    const doc = {
      id: product.id,
      productName: product.productName,
      brand: product.brand,
      description: product.description,
    };
    await this.opensearchServiceMod.index({
      index: "products",
      body: doc,
    });
  }

  async createNewProduct(userId: number, createProductDto: CreateProductDto) {
    const user = await this.usersRepo.findOneByOrFail({id: userId})

    if (user.role !== "admin"){
      throw new UnauthorizedException("You are not authorized to add a new product")
    }

    const subcategory = await this.subcategoriesRepo.findOneBy({
      id: createProductDto.subcategoryId,
    });

    const newProduct = this.productsRepo.create({
      ...createProductDto,
      subcategory,
    });
    await this.indexProduct(newProduct);
    return await this.productsRepo.save(newProduct);
  }
}
