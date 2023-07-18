import { Module } from '@nestjs/common';
import { SubcategoriesController } from './subcategories.controller';
import { SubcategoriesService } from './subcategories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subcategory } from 'src/entities/Subcategory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subcategory])],
  controllers: [SubcategoriesController],
  providers: [SubcategoriesService]
})
export class SubcategoriesModule {}
