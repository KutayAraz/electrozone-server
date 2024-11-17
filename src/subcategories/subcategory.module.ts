import { Module } from "@nestjs/common";
import { SubcategoryController } from "./subcategory.controller";
import { SubcategoryService } from "./subcategory.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Subcategory } from "src/entities/Subcategory.entity";
import { Product } from "src/entities/Product.entity";
import { CommonValidationService } from "src/common/services/common-validation.service";

@Module({
  imports: [TypeOrmModule.forFeature([Subcategory, Product])],
  controllers: [SubcategoryController],
  providers: [SubcategoryService, CommonValidationService],
  exports: [SubcategoryService],
})
export class SubcategoryModule {}
