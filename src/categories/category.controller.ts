import { Controller, Get, Param } from "@nestjs/common";
import { CategoryService } from "./category.service";
import { Public } from "src/common/decorators";
import { Category } from "src/entities/Category.entity";
import { CategoryInfo } from "./types/category-info.type";

@Controller("categories")
export class CategoryController {
  constructor(private categoriesService: CategoryService) { }

  @Public()
  @Get()
  async getCategories(): Promise<Category[]> {
    return this.categoriesService.getAllCategories();
  }

  @Public()
  @Get(':categoryName')
  async getCategoryInfo(@Param('categoryName') categoryName: string): Promise<CategoryInfo[]> {
    return this.categoriesService.getCategoryInformation(categoryName);
  }
}