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
      .getMany();
  }
}
