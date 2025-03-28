import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Repository, SelectQueryBuilder } from "typeorm";
import { ProductOrderBy, ProductQueryParams } from "./types/product-query.interface";
import { RawProduct } from "./types/raw-product.type";
import { ProductQueryResult } from "./types/product-query-result.type";
import { CacheResult } from "src/redis/cache-result.decorator";
import { OrderDirection } from "./enums/order-direction.enum";

@Injectable()
export class SubcategoryService {
  private readonly logger = new Logger(SubcategoryService.name);

  constructor(@InjectRepository(Product) private productsRepo: Repository<Product>) {}

  // Builds the base query for product retrieval, applying filters based on the provided parameters
  private createBaseQuery(params: ProductQueryParams): SelectQueryBuilder<Product> {
    const { subcategory, stockStatus, priceRange, brands } = params;

    let query = this.productsRepo
      .createQueryBuilder("product")
      .select([
        "product.id",
        "product.productName",
        "product.brand",
        "product.thumbnail",
        "product.averageRating",
        "product.price",
        "product.stock",
        "product.wishlisted",
      ])
      .addSelect("subcategory.subcategory", "subcategory")
      .leftJoin("product.subcategory", "subcategory")
      .addSelect("category.category", "category")
      .leftJoin("subcategory.category", "category")
      .where("subcategory.subcategory = :subcategory", { subcategory });

    // Apply additional filters based on query parameters
    if (stockStatus === "in_stock") {
      query = query.andWhere("product.stock > 0");
    }

    if (priceRange) {
      if (priceRange.min !== undefined) {
        query = query.andWhere("product.price >= :minPrice", { minPrice: priceRange.min });
      }
      if (priceRange.max !== undefined) {
        query = query.andWhere("product.price <= :maxPrice", { maxPrice: priceRange.max });
      }
    }

    if (brands && brands.length) {
      query = query.andWhere("product.brand IN (:...brands)", { brands });
    }

    return query;
  }

  private async executeQuery(
    query: SelectQueryBuilder<Product>,
    skip: number,
    limit: number,
    orderByField: string,
    orderDirection: "ASC" | "DESC",
  ): Promise<ProductQueryResult> {
    const count = await query.getCount();

    const rawProducts = await query
      .orderBy(orderByField, orderDirection)
      .offset(skip)
      .limit(limit)
      .getRawMany();

    const formattedProducts = rawProducts.map((rawProduct: RawProduct) => ({
      id: rawProduct.product_id,
      productName: rawProduct.product_productName,
      brand: rawProduct.product_brand,
      thumbnail: rawProduct.product_thumbnail,
      averageRating: rawProduct.product_averageRating,
      price: rawProduct.product_price,
      stock: rawProduct.product_stock,
      subcategory: rawProduct.subcategory,
      category: rawProduct.category,
    }));

    return { products: formattedProducts, productQuantity: count };
  }

  async getProducts(
    params: ProductQueryParams,
    orderByField: string,
    orderDirection: "ASC" | "DESC",
  ): Promise<ProductQueryResult> {
    const query = this.createBaseQuery(params);
    return this.executeQuery(query, params.skip, params.limit, orderByField, orderDirection);
  }

  @CacheResult({
    prefix: "subcategory-brands",
    ttl: 10800,
    paramKeys: ["subcategory"],
  })
  async getAllBrands(subcategory: string): Promise<string[]> {
    const brands = await this.productsRepo
      .createQueryBuilder("product")
      .select("DISTINCT(product.brand)", "brand")
      .leftJoin("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :subcategory", { subcategory })
      .orderBy("product.brand", "ASC")
      .getRawMany();

    return brands.map(brand => brand.brand);
  }

  @CacheResult({
    prefix: "subcategory-price-range",
    ttl: 10800,
    paramKeys: ["subcategory", "brand"],
  })
  async getPriceRange(subcategory: string, brand?: string): Promise<{ min: number; max: number }> {
    let query = this.productsRepo
      .createQueryBuilder("product")
      .select("MIN(product.price)", "min")
      .addSelect("MAX(product.price)", "max")
      .leftJoin("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :subcategory", { subcategory });

    if (brand) {
      query = query.andWhere("product.brand = :brand", { brand });
    }

    const result = await query.getRawOne();
    return {
      min: result.min,
      max: result.max,
    };
  }

  // Base method for retrieving products with custom ordering
  // Used by other methods to implement specific product listing features
  async getProductsWithOrder(
    params: ProductQueryParams,
    orderBy: ProductOrderBy,
    orderDirection: "ASC" | "DESC",
  ): Promise<ProductQueryResult> {
    return this.getProducts(params, orderBy, orderDirection);
  }

  @CacheResult({
    prefix: "subcategory-featured",
    ttl: 10800,
    paramKeys: ["params"],
  })
  async getFeaturedProducts(params: ProductQueryParams): Promise<ProductQueryResult> {
    return this.getProductsWithOrder(params, ProductOrderBy.SOLD, OrderDirection.DESC);
  }

  @CacheResult({
    prefix: "subcategory-best-rated",
    ttl: 10800,
    paramKeys: ["params"],
  })
  async getProductsBasedOnRating(params: ProductQueryParams): Promise<ProductQueryResult> {
    return this.getProductsWithOrder(params, ProductOrderBy.RATING, OrderDirection.DESC);
  }

  @CacheResult({
    prefix: "subcategory-asc-price",
    ttl: 10800,
    paramKeys: ["params"],
  })
  async getProductsByPriceAsc(params: ProductQueryParams): Promise<ProductQueryResult> {
    return this.getProductsWithOrder(params, ProductOrderBy.PRICE, OrderDirection.ASC);
  }

  @CacheResult({
    prefix: "subcategory-desc-prices",
    ttl: 10800,
    paramKeys: ["params"],
  })
  async getProductsByPriceDesc(params: ProductQueryParams): Promise<ProductQueryResult> {
    return this.getProductsWithOrder(params, ProductOrderBy.PRICE, OrderDirection.DESC);
  }

  @CacheResult({
    prefix: "subcategory-top-selling",
    ttl: 10800,
    paramKeys: ["params"],
  })
  async getTopSelling(params: ProductQueryParams): Promise<ProductQueryResult> {
    return this.getProductsWithOrder(params, ProductOrderBy.SOLD, OrderDirection.DESC);
  }

  @CacheResult({
    prefix: "subcategory-top-wishlisted",
    ttl: 10800,
    paramKeys: ["params"],
  })
  async getTopWishlistedProducts(params: ProductQueryParams): Promise<ProductQueryResult> {
    return this.getProductsWithOrder(params, ProductOrderBy.WISHLISTED, OrderDirection.DESC);
  }
}
