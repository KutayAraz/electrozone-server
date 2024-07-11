import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist";
import { SubcategoriesService } from "src/subcategories/subcategories.service";
import { Brackets, In, Not, Repository } from "typeorm";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Wishlist)
    private wishlistRepo: Repository<Wishlist>,
    private readonly subcategoriesService: SubcategoriesService
  ) { }

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

  async getSimilarProductsRandomly(productId: number, subcategoryId: number): Promise<Product[]> {
    const similarProducts = await this.productsRepo.query(
      `SELECT * FROM products WHERE subcategoryId = ? AND id != ? ORDER BY RAND() LIMIT 8`,
      [subcategoryId, productId]
    );
    return similarProducts;
  }

  async getSuggestedProducts(productId: number): Promise<{ suggestionType: string, products: Promise<Product[]> | Product[] }> {
    // Attempt to find frequently bought together products
    const result = await this.productsRepo
      .query(`
        SELECT oi2.productId, COUNT(*) as frequency
        FROM order_items oi1
        JOIN order_items oi2 ON oi1.orderId = oi2.orderId AND oi1.productId != oi2.productId
        JOIN orders o ON oi1.orderId = o.id
        WHERE oi1.productId = ?
        GROUP BY oi2.productId
        ORDER BY frequency DESC
        LIMIT 8;
      `, [productId]);

    if (result.length >= 5) {
      const recommendedProductIds = result.map(item => item.productId);
      return {
        suggestionType: "Frequently Bought Together", products: await this.productsRepo.find({
          where: {
            id: In(recommendedProductIds)
          }
        })
      };
    } else {
      // If not enough frequently bought together products, fetch similar products from the same subcategory
      const product = await this.productsRepo.findOne({
        where: { id: productId },
        relations: ['subcategory']
      });
      if (!product) {
        throw new Error('Product not found.');
      }

      const similarProducts = await this.getSimilarProductsRandomly(productId, product.subcategory.id)

      return { suggestionType: "Similar Products", products: similarProducts };
    }
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
        "product.brand",
        "product.thumbnail",
        "product.sold",
        "product.averageRating",
        "product.price",
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
      brand: row.brand,
      thumbnail: row.thumbnail,
      averageRating: row.averageRating,
      price: row.price,
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
        "product.brand",
        "product.thumbnail",
        "product.wishlisted",
        "product.averageRating",
        "product.price",
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
      brand: row.brand,
      thumbnail: row.thumbnail,
      averageRating: row.averageRating,
      price: row.price,
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
        "product.brand",
        "product.thumbnail",
        "product.averageRating",
        "product.price",
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
      brand: row.brand,
      thumbnail: row.thumbnail,
      averageRating: row.averageRating,
      price: row.price,
      subcategory: row.subcategory.subcategory,
      category: row.subcategory.category.category,
    }));
  }

  async findBySearch(
    search: string,
    skip: number,
    take: number,
    sort: string,
    stockStatus?: string,
    priceRange?: { min: number; max: number },
    brands?: string[],
    subcategories?: string[]) {
    const searchWords = search.split(" ");

    const baseQuery = this.productsRepo.createQueryBuilder("product")
      .leftJoinAndSelect("product.subcategory", "subcategory")
      .leftJoinAndSelect("subcategory.category", "category");

    // Apply the same base search criteria as your main query
    // This is necessary to ensure consistency between the datasets
    // (Notice we're cloning the baseQuery to avoid altering it directly)
    const brandsQuery = baseQuery.clone();
    const subcategoriesQuery = baseQuery.clone();
    const priceRangeQuery = baseQuery.clone();

    // Common where clause logic
    const applyCommonWhere = (query) => {
      query.where(
        new Brackets(qb => {
          searchWords.forEach((word, index) => {
            const likeKey = `likeSearch${index}`;
            const fragment = word.length > 2 ? word.substring(0, 3) : word;
            qb.orWhere(`product.productName LIKE :${likeKey}`, { [likeKey]: `%${fragment}%` });
            qb.orWhere("product.brand LIKE :brandSearch", { brandSearch: `%${search}%` });
            qb.orWhere("product.description LIKE :descriptionSearch", { descriptionSearch: `%${search}%` });
          });
        })
      );
    };

    applyCommonWhere(brandsQuery);
    applyCommonWhere(subcategoriesQuery);
    applyCommonWhere(priceRangeQuery);

    const priceRangeResult = await priceRangeQuery
      .select("MIN(product.price)", "min")
      .addSelect("MAX(product.price)", "max")
      .getRawOne();

    // Select distinct brands
    const uniqueBrands = await brandsQuery
      .select("DISTINCT product.brand", "brand")
      .orderBy("product.brand", "ASC") // Optional, for ordered results
      .getRawMany();

    // Select distinct subcategories
    const uniqueSubcategories = await subcategoriesQuery
      .select("DISTINCT subcategory.subcategory", "subcategory")
      .orderBy("subcategory.subcategory", "ASC") // Optional, for ordered results
      .getRawMany();

    // Now, apply filters and pagination to the main query
    applyCommonWhere(baseQuery);

    // Apply additional filters outside of the initial search brackets to ensure they are always applied
    if (priceRange) {
      baseQuery.andWhere("product.price BETWEEN :min AND :max", { min: priceRange.min, max: priceRange.max });
    }

    if (brands && brands.length > 0) {
      baseQuery.andWhere("product.brand IN (:...brands)", { brands });
    }

    if (subcategories && subcategories.length > 0) {
      baseQuery.andWhere("subcategory.subcategory IN (:...subcategories)", { subcategories });
    }

    if (stockStatus) {
      if (stockStatus === "in_stock") {
        baseQuery.andWhere("product.stock > 0");
      }
      // Extend this logic for other stockStatus values if necessary
    }

    if (sort) {
      switch (sort) {
        case "price_ascending":
          baseQuery.orderBy("product.price", "ASC");
          break;
        case "price_descending":
          baseQuery.orderBy("product.price", "DESC");
          break;
        case "top_rated":
          baseQuery.orderBy("product.avgRating", "DESC");
          break;
      }
    }

    // Get the count of filtered products
    const count = await baseQuery.getCount();

    // pagination
    const products = await baseQuery.offset(skip).limit(take).getMany();

    return {
      products,
      productQuantity: count,
      availableBrands: uniqueBrands.map(brand => brand.brand),
      availableSubcategories: uniqueSubcategories.map(subcat => subcat.subcategory),
      priceRange: priceRangeResult
    };
  }
}
