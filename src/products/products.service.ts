import { BadRequestException, Injectable } from "@nestjs/common";
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
import { DataSet, searchProductByKeyword } from "src/search/dtos/search.dto";
import { Client } from "@opensearch-project/opensearch";

@Injectable()
export class ProductsService {
  client: Client;
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(Review) private reviewsRepo: Repository<Review>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(Subcategory)
    private subcategoriesRepo: Repository<Subcategory>,
    @InjectRepository(Wishlist)
    private wishlistRepo: Repository<Wishlist>,
    private readonly openSearchClient: OpensearchClient,
  ) {
    this.client = new Client({
      node: "http://localhost:9200",
    });
  }

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

  async createNewProduct(createProductDto: CreateProductDto) {
    const subcategory = await this.subcategoriesRepo.findOneBy({
      id: createProductDto.subcategoryId,
    });

    const newProduct = this.productsRepo.create({
      ...createProductDto,
      subcategory,
    });

    await this.singleDataIngestion({
      indexName: "products",
      products: [
        {
          productName: newProduct.productName,
          brand: newProduct.brand,
          description: newProduct.description,
          id: `${newProduct.id}`,
        },
      ],
    });

    return await this.productsRepo.save(newProduct);
  }

  async searchForProducts(query: string) {
    return await this.searchCharaterByKeyword({
      indexName: "products",
      keyword: query,
    });
  }

  async bulkDataIngestion(input: DataSet): Promise<any> {
    console.log(
      `Inside bulkUpload() Method | Ingesting Bulk data of length ${input.products.length} having index ${input.indexName}`,
    );

    const body = input.products.flatMap((doc) => {
      return [{ index: { _index: input.indexName, _id: doc.id } }, doc];
    });

    try {
      let res = await this.openSearchClient.bulk({ body });
      return res.body;
    } catch (err) {
      console.log(`Exception occurred : ${err})`);
      return {
        httpCode: 500,
        error: err,
      };
    }
  }

  async singleDataIngestion(input: DataSet): Promise<any> {
    console.log(
      `Inside singleUpload() Method | Ingesting single data with index ${input.indexName} `,
    );

    let product = input.products[0];

    try {
      let res = await this.client.index({
        id: product.id,
        index: input.indexName,
        body: {
          id: product.id,
          productName: product.productName,
          brand: product.brand,
          description: product.description,
        },
      });
      return res.body;
    } catch (err) {
      console.log(`Exception occurred : ${err})`);
      return {
        httpCode: 500,
        error: err,
      };
    }
  }

  async searchCharaterByKeyword(input: searchProductByKeyword): Promise<any> {
    console.log(`Inside searchByKeyword() Method`);
    let body: any;

    console.log(
      `Searching for Keyword: ${input.keyword} in the index : ${input.indexName} `,
    );
    body = {
      query: {
        multi_match: {
          query: input.keyword,
        },
      },
    };

    try {
      let res = await this.openSearchClient.search({
        index: input.indexName,
        body,
      });
      if (res.body.hits.total.value == 0) {
        return {
          httpCode: 200,
          data: [],
          message: `No Data found based based on Keyword: ${input.keyword}`,
        };
      }
      let result = res.body.hits.hits.map((item) => {
        return {
          _id: item._id,
          data: item._source,
        };
      });

      return {
        httpCode: 200,
        data: result,
        message: `Data fetched successfully based on Keyword: ${input.keyword}`,
      };
    } catch (error) {
      console.log(`Exception occurred while doing : ${error})`);
      return {
        httpCode: 500,
        data: [],
        error: error,
      };
    }
  }
}
