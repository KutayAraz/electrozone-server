import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Brackets, Repository } from "typeorm";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { ProductDetails } from "../types/product-details.type";
import { SuggestedProducts } from "../types/suggested-products.type";
import { TopProduct } from "../types/top-product.type";
import { SearchResult } from "../types/search-result.type";
import { CacheResult } from "src/redis/cache-result.decorator";
import Decimal from "decimal.js";
import { RedisService } from "src/redis/redis.service";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { UserRole } from "src/users/types/user-role.enum";
import { UserService } from "src/users/services/user.service";

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    private readonly commonValidationService: CommonValidationService,
    private readonly userService: UserService,
    private readonly redisService: RedisService
  ) { }

  @CacheResult({
    prefix: 'product-details',
    ttl: 10800,
    paramKeys: ['id']
  })
  async getProductDetails(id: number): Promise<ProductDetails> {
    const product = await this.productsRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.productImages', 'productImages')
      .leftJoinAndSelect('product.subcategory', 'subcategory')
      .leftJoinAndSelect('subcategory.category', 'category')
      .select([
        'product.id',
        'product.productName',
        'product.brand',
        'product.description',
        'product.price',
        'product.stock',
        'product.averageRating',
        'product.thumbnail',
        'productImages.id',
        'productImages.productImage',
        'subcategory.subcategory',
        'category.category',
      ])
      .where('product.id = :id', { id })
      .getOne();

    this.commonValidationService.validateProduct(product);

    return {
      ...product,
      subcategory: product.subcategory.subcategory,
      category: product.subcategory.category.category,
      productImages: product.productImages,
    };
  }

  @CacheResult({
    prefix: 'product-similar',
    ttl: 10800,
    paramKeys: ['productId', 'subcategoryId']
  })
  async getRandomSimilarProducts(productId: number, subcategoryId: number): Promise<Product[]> {
    return this.productsRepo.createQueryBuilder('product')
      .where('product.subcategoryId = :subcategoryId', { subcategoryId })
      .andWhere('product.id != :productId', { productId })
      .orderBy('RAND()')
      .limit(8)
      .getMany();
  }

  @CacheResult({
    prefix: 'product-suggested',
    ttl: 10800,
    paramKeys: ['productId']
  })
  async getSuggestedProducts(productId: number): Promise<SuggestedProducts> {
    // Attempt to find frequently bought together products
    const frequentlyBoughtTogether = await this.productsRepo
      .createQueryBuilder('product')
      .select('product.id', 'productId')
      .addSelect('COUNT(*)', 'frequency')
      .innerJoin('order_items', 'oi1', 'oi1.productId = :productId', { productId })
      .innerJoin('order_items', 'oi2', 'oi1.orderId = oi2.orderId AND oi1.productId != oi2.productId')
      .innerJoin('orders', 'o', 'oi1.orderId = o.id')
      .where('oi2.productId = product.id')
      .groupBy('product.id')
      .orderBy('frequency', 'DESC')
      .limit(8)
      .getRawMany();


    let baseProductQuery = this.productsRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.subcategory', 'subcategory')
      .leftJoinAndSelect('subcategory.category', 'category')
      .select([
        'product.id',
        'product.productName',
        'product.brand',
        'product.thumbnail',
        'product.averageRating',
        'product.price',
        'product.stock',
        'subcategory.subcategory',
        'category.category'
      ]);

    if (frequentlyBoughtTogether.length >= 5) {
      const recommendedProductIds = frequentlyBoughtTogether.map(item => item.productId);
      const products = await baseProductQuery
        .where('product.id IN (:...ids)', { ids: recommendedProductIds })
        .getMany();

      return {
        suggestionType: "Frequently Bought Together",
        products: products.map(p => ({
          ...p,
          category: p.subcategory.category.category,
          subcategory: p.subcategory.subcategory
        }))
      };
    } else {
      const product = await this.productsRepo.findOne({
        where: { id: productId },
        relations: ['subcategory']
      });

      this.commonValidationService.validateProduct(product);

      const products = await baseProductQuery
        .where('product.subcategoryId = :subcategoryId', { subcategoryId: product.subcategory.id })
        .andWhere('product.id != :productId', { productId })
        .orderBy('RAND()')
        .limit(8)
        .getMany();

      return {
        suggestionType: "Similar Products", products: products.map(p => ({
          ...p,
          category: p.subcategory.category.category,
          subcategory: p.subcategory.subcategory
        }))
      };
    }
  }

  @CacheResult({
    prefix: 'product-top-products',
    ttl: 10800,
    paramKeys: ['orderBy', 'take']
  })
  async getTopProducts(
    orderBy: 'sold' | 'wishlisted' | 'averageRating',
    take: number = 10
  ): Promise<TopProduct[]> {
    const selectFields = [
      'product.id',
      'product.productName',
      'product.brand',
      'product.thumbnail',
      'product.averageRating',
      'product.price',
      'product.stock',
    ];

    // Only add the orderBy field if it's not averageRating (which is already included)
    if (orderBy !== 'averageRating') {
      selectFields.push(`product.${orderBy}`);
    }

    const rawData = await this.productsRepo
      .createQueryBuilder('product')
      .select(selectFields)
      .leftJoin('product.subcategory', 'subcategory')
      .addSelect(['subcategory.subcategory'])
      .leftJoin('subcategory.category', 'category')
      .addSelect(['category.category'])
      .orderBy(`product.${orderBy}`, 'DESC')
      .take(take)
      .getMany();

    return rawData.map((row) => ({
      id: row.id,
      productName: row.productName,
      brand: row.brand,
      thumbnail: row.thumbnail,
      averageRating: row.averageRating,
      price: row.price,
      stock: row.stock,
      subcategory: row.subcategory.subcategory,
      category: row.subcategory.category.category,
      [orderBy]: row[orderBy],
    }));
  }

  @CacheResult({
    prefix: 'product-best-sellers',
    ttl: 10800,
    paramKeys: ['take']
  })
  async getBestSellers(take: number = 10): Promise<TopProduct[]> {
    return this.getTopProducts('sold', take);
  }

  @CacheResult({
    prefix: 'product-top-wishlisted',
    ttl: 10800,
    paramKeys: ['take']
  })
  async getTopWishlisted(take: number = 10): Promise<TopProduct[]> {
    return this.getTopProducts('wishlisted', take);
  }

  @CacheResult({
    prefix: 'product-best-rated',
    ttl: 10800,
    paramKeys: ['take']
  })
  async getBestRated(take: number = 10): Promise<TopProduct[]> {
    return this.getTopProducts('averageRating', take);
  }

  async findBySearch(
    search: string,
    skip: number,
    take: number,
    sort: string,
    stockStatus?: string,
    priceRange?: { min: number; max: number },
    brands?: string[],
    subcategories?: string[]): Promise<SearchResult> {
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
            // Use the first 3 characters of the word if it's longer than 2 characters
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

  async updateProductPrice(productId: number, newPrice: string) {
    return await this.productsRepo.manager.transaction(async transactionalEntityManager => {
      const product = await transactionalEntityManager
        .findOneBy(Product, { id: productId });

      if (!product) {
        throw new Error('Product not found');
      }

      product.price = new Decimal(newPrice).toString();
      await transactionalEntityManager.save(Product, product);
      await this.redisService.invalidateProductCache(productId);

      return product;
    });
  }

  async updateProductPriceAndStock(
    userUuid: string,
    productId: number, updates: {
      newPrice?: string;
      newStock?: number
    }) {
    await this.isAuthorizedToAlter(userUuid);

    return await this.productsRepo.manager.transaction(async transactionalEntityManager => {
      const product = await transactionalEntityManager
        .findOneBy(Product, { id: productId });

      if (!product) {
        throw new AppError(ErrorType.PRODUCT_NOT_FOUND, 'Product not found');
      }

      if (updates.newPrice) {
        product.price = new Decimal(updates.newPrice).toString();
      }

      if (typeof updates.newStock === 'number') {
        if (updates.newStock < 0) {
          throw new Error('Stock cannot be negative');
        }
        product.stock = updates.newStock;
      }

      await transactionalEntityManager.save(Product, product);
      await this.redisService.invalidateProductCache(productId);

      return product;
    });
  }


  async isAuthorizedToAlter(userUuid: string) {
    const user = await this.userService.findByUuid(userUuid);

    if (!user) {
      throw new AppError(ErrorType.USER_NOT_FOUND, 'User not found');
    }

    if (![UserRole.ADMIN, UserRole.PRODUCT_MANAGER].includes(user.role)) {
      throw new AppError(ErrorType.UNAUTHORIZED, 'User not authorized to modify products');
    }

    return true;
  }
}
