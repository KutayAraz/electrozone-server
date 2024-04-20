import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Repository } from "typeorm";

@Injectable()
export class SubcategoriesService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) { }

  async getProducts(subcategory: string,
    orderByField: string,
    orderDirection: 'ASC' | 'DESC',
    skip: number,
    take: number,
    stockStatus?: string, // "in_stock" or "out_of_stock"
    priceRange?: { min: number; max: number },
    brands?: string[]) {

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

    // Filter by price range
    if (priceRange) {
      var minPrice = priceRange.min
      var maxPrice = priceRange.max
      query = query.andWhere("product.price BETWEEN :min AND :max", {
        min: minPrice,
        max: maxPrice,
      });
    }

    // If minPrice is provided, add a condition for it
    if (minPrice) {
      query = query.andWhere("product.price >= :minPrice", { minPrice });
    }

    // If maxPrice is provided, add a condition for it
    if (maxPrice) {
      query = query.andWhere("product.price <= :maxPrice", { maxPrice });
    }


    // Filter by brands
    if (brands && brands.length) {
      query = query.andWhere("product.brand IN (:...brands)", { brands });
    }

    const count = await query.getCount();

    // Sorting, pagination
    query = query.orderBy(orderByField, orderDirection)
      .offset(skip)
      .limit(take);

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

  async getFeaturedProducts(subcategory: string, skip: number, limit: number, stockStatus?: string, priceRange?: { min: number; max: number }, brands?: string[]) {
    return await this.getProducts(subcategory, "product.sold", "DESC", skip, limit, stockStatus, priceRange, brands);
  }

  async getProductsBasedOnRating(subcategory: string, skip: number, limit: number, stockStatus?: string, priceRange?: { min: number; max: number }, brands?: string[]) {
    return await this.getProducts(subcategory, "product.averageRating", "DESC", skip, limit, stockStatus, priceRange, brands);
  }

  async getProductsByPriceAsc(subcategory: string, skip: number, limit: number, stockStatus?: string, priceRange?: { min: number; max: number }, brands?: string[]) {
    return await this.getProducts(subcategory, "product.price", "ASC", skip, limit, stockStatus, priceRange, brands);
  }

  async getProductsByPriceDesc(subcategory: string, skip: number, limit: number, stockStatus?: string, priceRange?: { min: number; max: number }, brands?: string[]) {
    return await this.getProducts(subcategory, "product.price", "DESC", skip, limit, stockStatus, priceRange, brands);
  }

  async getTopSelling(subcategory: string, skip: number, limit: number, stockStatus?: string, priceRange?: { min: number; max: number }, brands?: string[]) {
    return await this.getProducts(subcategory, "product.sold", "DESC", skip, limit, stockStatus, priceRange, brands);
  }

  async getTopWishlistedProducts(subcategory: string, skip: number, limit: number, stockStatus?: string, priceRange?: { min: number; max: number }, brands?: string[]) {
    return await this.getProducts(subcategory, "product.wishlisted", "DESC", skip, limit, stockStatus, priceRange, brands);
  }
}
