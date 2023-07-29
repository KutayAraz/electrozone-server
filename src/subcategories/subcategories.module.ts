import { Module } from '@nestjs/common';
import { SubcategoriesController } from './subcategories.controller';
import { SubcategoriesService } from './subcategories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subcategory } from 'src/entities/Subcategory.entity';
import { Product } from 'src/entities/Product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subcategory, Product])],
  controllers: [SubcategoriesController],
  providers: [SubcategoriesService]
})
export class SubcategoriesModule {}
