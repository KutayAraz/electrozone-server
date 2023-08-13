import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Category } from "src/entities/Category.entity";
import { Subcategory } from "src/entities/Subcategory.entity";
import { SubcategoriesService } from "src/subcategories/subcategories.service";
import { Repository } from "typeorm";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private categoriesRepo: Repository<Category>,
    @InjectRepository(Subcategory)
    private subcategoriesRepo: Repository<Subcategory>,
    private readonly subcategoriesService: SubcategoriesService,
  ) {}

  async getAllCategories(): Promise<Category[]> {
    return this.categoriesRepo.find();
  }

  async getCategoryInformation(category: string) {
    const subcategories = await this.getSubcategories(category);
  
    const topProductsPromise = subcategories.map(async (subcategory) => {
      const topSelling = await this.subcategoriesService.getTopSelling(subcategory);
      const topWishlisted = await this.subcategoriesService.getTopWishlistedProducts(subcategory);
  
      return {
        subcategory,
        topSelling,
        topWishlisted,
      };
    });
  
    return Promise.all(topProductsPromise);
  }

  async getSubcategories(category: string) {
    const subcategories = await this.subcategoriesRepo
      .createQueryBuilder("subcategory")
      .innerJoinAndSelect("subcategory.category", "category")
      .where("category.category = :category", { category })
      .select("subcategory.subcategory")
      .getMany();

    return subcategories.map((sub) => sub.subcategory);
  }
}
