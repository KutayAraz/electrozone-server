import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Repository } from "typeorm";

@Injectable()
export class SubcategoriesService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) { }

  async getProducts(subcategory: string, orderByField: string, orderDirection: 'ASC' | 'DESC', skip: number, take: number) {
    const rawProducts = await this.productsRepo
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
      .orderBy(orderByField, orderDirection)
      .offset(skip) // Skip the previous pages
      .limit(take) // Take the next 'limit' number of items
      .getRawMany();

    return rawProducts.map((rawProduct) => ({
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
  }

  async getFeaturedProducts(subcategory: string, skip: number, limit: number) {
    return await this.getProducts(subcategory, "product.sold", "DESC", skip, limit);
  }

  async getProductsBasedOnRating(subcategory: string, skip: number, limit: number) {
    return await this.getProducts(subcategory, "product.averageRating", "DESC", skip, limit);
  }

  async getProductsByPriceAsc(subcategory: string, skip: number, limit: number) {
    return await this.getProducts(subcategory, "product.price", "ASC", skip, limit);
  }

  async getProductsByPriceDesc(subcategory: string, skip: number, limit: number) {
    return await this.getProducts(subcategory, "product.price", "DESC", skip, limit);
  }

  async getTopSelling(subcategory: string, skip: number, limit: number) {
    return await this.getProducts(subcategory, "product.sold", "DESC", skip, limit);
  }

  async getTopWishlistedProducts(subcategory: string, skip: number, limit: number) {
    return await this.getProducts(subcategory, "product.wishlisted", "DESC", skip, limit);
  }
}
