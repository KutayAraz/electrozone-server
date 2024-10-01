import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ProductService } from "../services/product.service";
import { Public } from "src/common/decorators/public.decorator";
import { SearchResult } from "../types/search-result.type";
import { TopProduct } from "../types/top-product.type";
import { ProductDetails } from "../types/product-details.type";
import { SuggestedProducts } from "../types/suggested-products.type";

@Controller("product")
export class ProductController {
  constructor(private productService: ProductService) { }

  @Public()
  @Get("/most-wishlisted")
  async getMostWishlisted(): Promise<TopProduct[]> {
    return await this.productService.getTopWishlisted();
  }

  @Public()
  @Get("best-sellers")
  async getBestSellers(): Promise<TopProduct[]> {
    return await this.productService.getBestSellers();
  }

  @Public()
  @Get("best-rated")
  async getBestRated(): Promise<TopProduct[]> {
    return await this.productService.getBestRated();
  }

  @Public()
  @Get(":id")
  async getProductDetails(@Param("id", ParseIntPipe) id: number): Promise<ProductDetails> {
    return await this.productService.getProductDetails(id);
  }

  @Public()
  @Get(':id/suggested-products')
  async getSuggestedProducts(@Param('id') productId: number): Promise<SuggestedProducts> {
    return await this.productService.getSuggestedProducts(productId);
  }

  @Public()
  @Get()
  async getProductsBySearch(
    @Query("query") encodedSearchQuery: string,
    @Query("skip") skip: number = 0,
    @Query("limit") take: number = 10,
    @Query("sort") sort: string = "relevance",
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPrice: number = 0,
    @Query("max_price") maxPrice?: number,
    @Query("brands") brandString?: string,
    @Query("subcategories") subcategoriesString?: string,
  ): Promise<SearchResult> {
    const searchQuery = decodeURIComponent(encodedSearchQuery);
    const brands = brandString ? brandString.split(' ').map(decodeURIComponent) : undefined;
    const subcategories = subcategoriesString ? subcategoriesString.split(' ').map(decodeURIComponent) : undefined;

    const priceRange = maxPrice ? { min: minPrice, max: maxPrice } : undefined;
    return this.productService.findBySearch(
      searchQuery,
      skip,
      take,
      sort,
      stockStatus,
      priceRange,
      brands,
      subcategories);
  }
}
