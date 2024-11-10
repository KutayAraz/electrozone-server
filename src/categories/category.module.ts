import { Module } from "@nestjs/common";
import { Category } from "src/entities/Category.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SubcategoryService } from "src/subcategories/subcategory.service";
import { Subcategory } from "src/entities/Subcategory.entity";
import { Product } from "src/entities/Product.entity";
import { CategoryController } from "./category.controller";
import { CategoryService } from "./category.service";
import { RedisService } from "src/redis/redis.service";

@Module({
  imports: [TypeOrmModule.forFeature([Category, Subcategory, Product])],
  controllers: [CategoryController],
  providers: [CategoryService, SubcategoryService, RedisService],
})
export class CategoriesModule { }
