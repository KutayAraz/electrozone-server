import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist.entity";
import { SubcategoriesService } from "src/subcategories/subcategories.service";
import { Brackets, In, Not, Repository } from "typeorm";
import TopProductDto from "./dtos/top-product.dto";

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
    const product = await this.productsRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.productImages', 'productImages')
      .leftJoinAndSelect('product.subcategory', 'subcategory')
      .leftJoinAndSelect('subcategory.category', 'category')
      .leftJoinAndSelect('product.reviews', 'reviews')
      .select([
        'product',
        'productImages',
        'subcategory.subcategory',
        'category.category',
        'reviews'
      ])
      .where('product.id = :id', { id })
      .getOne();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const { sold, wishlisted, subcategory, ...returnedProduct } = product;
    return {
      ...returnedProduct,
      subcategory: subcategory.subcategory,
      category: subcategory.category.category,
    };
  }

  async getSimilarProductsRandomly(productId: number, subcategoryId: number): Promise<Product[]> {
    return this.productsRepo.createQueryBuilder('product')
      .where('product.subcategoryId = :subcategoryId', { subcategoryId })
      .andWhere('product.id != :productId', { productId })
      .orderBy('RAND()')
      .limit(8)
      .getMany();
  }

  async getSuggestedProducts(productId: number): Promise<{ suggestionType: string, products: Promise<Product[]> | Product[] }> {
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

    if (frequentlyBoughtTogether.length >= 5) {
      const recommendedProductIds = frequentlyBoughtTogether.map(item => item.productId);
      const products = await this.productsRepo.findByIds(recommendedProductIds);
      return { suggestionType: "Frequently Bought Together", products };
    } else {
      const product = await this.productsRepo.findOne({
        where: { id: productId },
        relations: ['subcategory']
      });
      if (!product) {
        throw new NotFoundException('Product not found.');
      }

      const products = await this.getSimilarProductsRandomly(productId, product.subcategory.id);
      return { suggestionType: "Similar Products", products };
    }
  }

  async getTopProducts(
    orderBy: 'sold' | 'wishlisted' | 'averageRating',
    take: number = 10
  ): Promise<TopProductDto[]> {
    const selectFields = [
      'product.id',
      'product.productName',
      'product.brand',
      'product.thumbnail',
      'product.averageRating',
      'product.price',
      'product.stock',
    ];

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

  async getTopSelling(take: number = 10): Promise<TopProductDto[]> {
    return this.getTopProducts('sold', take);
  }

  async getTopWishlisted(take: number = 10): Promise<TopProductDto[]> {
    return this.getTopProducts('wishlisted', take);
  }

  async getBestRated(take: number = 10): Promise<TopProductDto[]> {
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
