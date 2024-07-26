import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Repository } from "typeorm";
import { ProductQueryParams } from "./types/product-query.interface";

enum ProductOrderBy {
  SOLD = "product.sold",
  RATING = "product.averageRating",
  PRICE = "product.price",
  WISHLISTED = "product.wishlisted"
}

@Injectable()
export class SubcategoriesService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) { }

  async getProducts(params: ProductQueryParams, orderByField: string, orderDirection: 'ASC' | 'DESC') {
    const { subcategory, skip, limit, stockStatus, priceRange, brands } = params;
    
    // Base query
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
      .where("subcategory.subcategory = :subcategory", { subcategory })

    // Filter by stock status
    if (stockStatus) {
      if (stockStatus === "in_stock") {
        query = query.andWhere("product.stock > 0");
      }
    }

    if (priceRange) {
      if (priceRange.min !== undefined) {
        query = query.andWhere("product.price >= :minPrice", { minPrice: priceRange.min });
      }
      if (priceRange.max !== undefined) {
        query = query.andWhere("product.price <= :maxPrice", { maxPrice: priceRange.max });
      }
    }

    // Filter by brands
    if (brands && brands.length) {
      query = query.andWhere("product.brand IN (:...brands)", { brands });
    }

    const count = await query.getCount();

    // Sorting, pagination
    query = query.orderBy(orderByField, orderDirection)
      .offset(skip)
      .limit(limit);

    const rawProducts = await query.getRawMany();

    const formattedProducts = rawProducts.map((rawProduct) => ({
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

    return { products: formattedProducts, productQuantity: count }
  }

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

  async getProductsWithOrder(params: ProductQueryParams, orderBy: ProductOrderBy, orderDirection: 'ASC' | 'DESC') {
    return await this.getProducts(params, orderBy, orderDirection);
  }

  async getFeaturedProducts(params: ProductQueryParams) {
    return await this.getProductsWithOrder(params, ProductOrderBy.SOLD, 'DESC');
  }

  async getProductsBasedOnRating(params: ProductQueryParams) {
    return this.getProductsWithOrder(params, ProductOrderBy.RATING, 'DESC');
  }

  async getProductsByPriceAsc(params: ProductQueryParams) {
    return this.getProductsWithOrder(params, ProductOrderBy.PRICE, 'ASC');
  }

  async getProductsByPriceDesc(params: ProductQueryParams) {
    return this.getProductsWithOrder(params, ProductOrderBy.PRICE, 'DESC');
  }

  async getTopSelling(params: ProductQueryParams) {
    return this.getProductsWithOrder(params, ProductOrderBy.SOLD, 'DESC');
  }

  async getTopWishlistedProducts(params: ProductQueryParams) {
    return this.getProductsWithOrder(params, ProductOrderBy.WISHLISTED, 'DESC');
  }
}
