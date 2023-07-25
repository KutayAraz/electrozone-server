import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { Repository } from "typeorm";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) {}

  async findProduct(subcategory: string, productId: number) {
    return await this.productsRepo
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.subcategory", "subcategory")
      .where("subcategory.subcategory = :subcategory", { subcategory })
      .getMany();
  }
}
