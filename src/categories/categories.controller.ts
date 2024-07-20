import { Controller, Get, Param } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { Public } from "src/common/decorators";
import { Category } from "src/entities/Category.entity";
import { CategoryInfo } from "./types/category-info.type";

@Controller("categories")
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) { }

  @Public()
  @Get()
  async getCategories(): Promise<Category[]> {
    return await this.categoriesService.getAllCategories();
  }

  @Public()
  @Get(':categoryName')
  async getCategoryInfo(@Param('categoryName') categoryName: string): Promise<CategoryInfo[]> {
    return await this.categoriesService.getCategoryInformation(categoryName);
  }
}
