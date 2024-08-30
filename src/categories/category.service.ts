import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { Category } from "src/entities/Category.entity";
import { Subcategory } from "src/entities/Subcategory.entity";
import { SubcategoryService } from "src/subcategories/subcategory.service";
import { Repository } from "typeorm";
import { SubcategoryTopProducts } from "./types/subcategory-top-products.type";

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectRepository(Category) private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(Subcategory) private readonly subcategoriesRepo: Repository<Subcategory>,
    private readonly subcategoriesService: SubcategoryService,
  ) { }

  async getAllCategories(): Promise<Category[]> {
    try {
      const categories = await this.categoriesRepo.find();
      return categories;
    } catch (error) {
      this.logger.error(`Error getting categories: ${error.message}`, error.stack);
      throw new AppError(ErrorType.DATABASE_ERROR);
    }
  }

  async getCategoryInformation(category: string): Promise<SubcategoryTopProducts[]> {
    try {
      const subcategories = await this.getSubcategories(category);
      return this.getTopProductsForSubcategories(subcategories);
    } catch (error) {
      throw error instanceof AppError ? error : new AppError(ErrorType.CATEGORY_INFO_ERROR, undefined, category);
    }
  }

  async getSubcategories(category: string): Promise<string[]> {
    try {
      const subcategories = await this.subcategoriesRepo
        .createQueryBuilder("subcategory")
        .innerJoin("subcategory.category", "category")
        .where("category.category = :category", { category })
        .select("subcategory.subcategory")
        .getMany();

      return subcategories.map((sub) => sub.subcategory);
    } catch (error) {
      this.logger.error(`Error getting subcategories of ${category}: ${error.message}`, error.stack);
      throw new AppError(ErrorType.DATABASE_ERROR, undefined, category);
    }
  }

  private async getTopProductsForSubcategories(subcategories: string[]): Promise<SubcategoryTopProducts[]> {
    try {
      const topProductsPromises = subcategories.map(async (subcategory) => {
        const [topSelling, topWishlisted] = await Promise.all([
          this.subcategoriesService.getTopSelling({ subcategory, skip: 0, limit: 12 }),
          this.subcategoriesService.getTopWishlistedProducts({ subcategory, skip: 0, limit: 12 }),
        ]);
        return { subcategory, topSelling, topWishlisted };
      });

      return Promise.all(topProductsPromises);
    } catch (error) {
      this.logger.error(`Error getting top products for ${subcategories}: ${error.message}`, error.stack);
      throw new AppError(ErrorType.DATABASE_ERROR);
    }
  }
}