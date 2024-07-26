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
  ) { }

  async getAllCategories(): Promise<Category[]> {
    return this.categoriesRepo.find();
  }

  async getCategoryInformation(category: string) {
    const subcategories = await this.getSubcategories(category);

    const topProducts = await Promise.all(
      subcategories.map(async (subcategory: string) => {
        const [topSelling, topWishlisted] = await Promise.all([
          this.subcategoriesService.getTopSelling({subcategory, skip: 0, limit: 12}),
          this.subcategoriesService.getTopWishlistedProducts({subcategory, skip: 0, limit: 12}),
        ]);
        return { subcategory, topSelling, topWishlisted };
      })
    );
    return topProducts;
  }

  async getSubcategories(category: string) {
    const subcategories = await this.subcategoriesRepo
      .createQueryBuilder("subcategory")
      .innerJoin("subcategory.category", "category", "category.category = :category", { category })
      .select("subcategory.subcategory")
      .getMany();

    return subcategories.map((sub) => sub.subcategory);
  }
}
