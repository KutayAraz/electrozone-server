import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Repository } from "typeorm";

@Injectable()
export class SubcategoriesService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) {}

  async findProducts(subcategory: string) {
    return await this.productsRepo
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :subcategory", { subcategory })
      .orderBy("product.sold", "DESC")
      .getMany();
  }

  async getProductsBasedOnRating(subcategory: string) {
    return await this.productsRepo
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :subcategory", { subcategory })
      .orderBy("product.averageRating", "DESC")
      .getMany();
  }

  async getProductsByPriceAsc(subcategory: string) {
    return await this.productsRepo
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :subcategory", { subcategory })
      .orderBy("product.price", "ASC")
      .getMany();
  }

  async getProductsByPriceDesc(subcategory: string) {
    return await this.productsRepo
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :subcategory", { subcategory })
      .orderBy("product.price", "DESC")
      .getMany();
  }

  async getTopSelling(subcategoryName: string) {
    return this.productsRepo
      .createQueryBuilder("product")
      .innerJoinAndSelect("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :name", {
        name: subcategoryName,
      })
      .orderBy("product.sold", "DESC")
      .take(5)
      .getMany();
  }

  async getTopWishlistedProducts(subcategoryName: string) {
    return this.productsRepo
      .createQueryBuilder("product")
      .innerJoinAndSelect("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :name", {
        name: subcategoryName,
      })
      .orderBy("product.wishlisted", "DESC")
      .take(5)
      .getMany();
  }
}
