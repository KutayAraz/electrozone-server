import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Repository } from "typeorm";

@Injectable()
export class SubcategoriesService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) { }

  async getProducts(subcategory: string, orderByField: string, orderDirection: 'ASC' | 'DESC', page: number, limit: number) {
    const offset = (page - 1) * limit;
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
      .offset(offset) // Skip the previous pages
      .limit(limit) // Take the next 'limit' number of items
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

  async getFeaturedProducts(subcategory: string, page: number, limit: number) {
    return await this.getProducts(subcategory, "product.sold", "DESC", page, limit);
  }

  async getProductsBasedOnRating(subcategory: string, page: number, limit: number) {
    return await this.getProducts(subcategory, "product.averageRating", "DESC", page, limit);
  }

  async getProductsByPriceAsc(subcategory: string, page: number, limit: number) {
    return await this.getProducts(subcategory, "product.price", "ASC", page, limit);
  }

  async getProductsByPriceDesc(subcategory: string, page: number, limit: number) {
    return await this.getProducts(subcategory, "product.price", "DESC", page, limit);
  }

  async getTopSelling(subcategory: string, page: number, limit: number) {
    return await this.getProducts(subcategory, "product.sold", "DESC", page, limit);
  }

  async getTopWishlistedProducts(subcategory: string, page: number, limit: number) {
    return await this.getProducts(subcategory, "product.wishlisted", "DESC", page, limit);
  }
}
