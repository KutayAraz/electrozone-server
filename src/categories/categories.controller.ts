import { Controller, Get, Param } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { Public } from "src/common/decorators";

@Controller("categories")
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Public()
  @Get("all")
  async getCategories() {
    return this.categoriesService.getAllCategories();
  }

  @Public()
  @Get(":categoryName")
  async getCategoryInfo(@Param("categoryName") categoryName: string) {
    return this.categoriesService.getCategoryInformation(categoryName);
  }
}
