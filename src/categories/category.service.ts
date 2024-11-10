import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Category } from "src/entities/Category.entity";
import { Subcategory } from "src/entities/Subcategory.entity";
import { SubcategoryService } from "src/subcategories/subcategory.service";
import { Repository } from "typeorm";
import { SubcategoryTopProducts } from "./types/subcategory-top-products.type";
import { CacheResult } from "src/redis/cache-result.decorator";
import { RedisService } from "src/redis/redis.service";
@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category) private readonly categoriesRepo: Repository<Category>,
    @InjectRepository(Subcategory) private readonly subcategoriesRepo: Repository<Subcategory>,
    private readonly subcategoriesService: SubcategoryService,
    private readonly redisService: RedisService
  ) { }

  @CacheResult({
    prefix: 'category-information',
    ttl: 10800, // 3 hours in seconds
    paramKeys: []
  })
  async getAllCategories(): Promise<Category[]> {
    return await this.categoriesRepo.find();
  }

  // Fetches subcategories and their top products for a given category
  async getCategoryInformation(category: string): Promise<SubcategoryTopProducts[]> {
    const subcategories = await this.getSubcategories(category);
    return this.getTopProductsForSubcategories(subcategories);
  }

  // Retrieves subcategories for a given category using a custom query
  async getSubcategories(category: string): Promise<string[]> {
    const subcategories = await this.subcategoriesRepo
      .createQueryBuilder("subcategory")
      .innerJoin("subcategory.category", "category")
      .where("category.category = :category", { category })
      .select("subcategory.subcategory")
      .getMany();

    return subcategories.map((sub) => sub.subcategory);
  }

  // Fetches top selling and wishlisted products for each subcategory
  private async getTopProductsForSubcategories(subcategories: string[]): Promise<SubcategoryTopProducts[]> {
    const topProductsPromises = subcategories.map(async (subcategory) => {
      const [topSelling, topWishlisted] = await Promise.all([
        this.subcategoriesService.getTopSelling({ subcategory, skip: 0, limit: 12 }),
        this.subcategoriesService.getTopWishlistedProducts({ subcategory, skip: 0, limit: 12 }),
      ]);
      return { subcategory, topSelling, topWishlisted };
    });

    return Promise.all(topProductsPromises);
  }
}