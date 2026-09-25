import { Module } from "@nestjs/common";
import { Category } from "src/entities/Category.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Subcategory } from "src/entities/Subcategory.entity";
import { SubcategoryModule } from "src/subcategories/subcategory.module";
import { CategoryController } from "./category.controller";
import { CategoryService } from "./category.service";

@Module({
  imports: [TypeOrmModule.forFeature([Category, Subcategory]), SubcategoryModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoriesModule {}
