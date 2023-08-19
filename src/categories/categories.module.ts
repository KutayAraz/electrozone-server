import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { Category } from "src/entities/Category.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SubcategoriesService } from "src/subcategories/subcategories.service";
import { Subcategory } from "src/entities/Subcategory.entity";
import { Product } from "src/entities/Product.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Category, Subcategory, Product])],
  controllers: [CategoriesController],
  providers: [CategoriesService, SubcategoriesService],
})
export class CategoriesModule {}
