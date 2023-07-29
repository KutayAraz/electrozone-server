import { Controller, Get, Param } from "@nestjs/common";
import { SubcategoriesService } from "./subcategories.service";

@Controller("subcategories")
export class SubcategoriesController {
  constructor(private subcategoriesService: SubcategoriesService) {}

  @Get(":subcategory")
  async getAllProducts(@Param("subcategory") subcategory: string) {
    return await this.subcategoriesService.findProducts(subcategory);
  }
}
