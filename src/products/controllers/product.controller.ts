import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { Public } from "src/common/decorators/public.decorator";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { clampPageSize, parseOffset, safeDecodeURIComponent } from "src/common/utils/query-params";
import { ProductService } from "../services/product.service";
import { ProductDetails } from "../types/product-details.type";
import { SearchResult } from "../types/search-result.type";
import { SuggestedProducts } from "../types/suggested-products.type";
import { TopProduct } from "../types/top-product.type";

@Controller("product")
export class ProductController {
  constructor(private productService: ProductService) {}

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
  @Get(":id/suggested-products")
  async getSuggestedProducts(
    @Param("id", ParseIntPipe) productId: number,
  ): Promise<SuggestedProducts> {
    return await this.productService.getSuggestedProducts(productId);
  }

  @Public()
  @Get()
  async getProductsBySearch(
    @Query("query") encodedSearchQuery = "",
    @Query("skip") skip?: string,
    @Query("limit") take?: string,
    @Query("sort") sort = "relevance",
    @Query("stock_status") stockStatus?: string,
    @Query("min_price") minPrice?: string,
    @Query("max_price") maxPrice?: string,
    @Query("brands") brandString?: string,
    @Query("subcategories") subcategoriesString?: string,
  ): Promise<SearchResult> {
    const searchQuery = safeDecodeURIComponent(encodedSearchQuery);
    const brands = brandString ? brandString.split(" ").map(safeDecodeURIComponent) : undefined;
    const subcategories = subcategoriesString
      ? subcategoriesString.split(" ").map(safeDecodeURIComponent)
      : undefined;

    const max = Number(maxPrice);
    const priceRange = max > 0 ? { min: Number(minPrice) || 0, max } : undefined;

    return this.productService.findBySearch(
      searchQuery,
      parseOffset(skip),
      clampPageSize(take, 10),
      sort,
      stockStatus,
      priceRange,
      brands,
      subcategories,
    );
  }

  @Post()
  async alterProduct(
    @UserUuid() userUuid: string,
    @Body("productId") productId: number,
    @Body("updates")
    updates: {
      newPrice?: string;
      newStock?: number;
    },
  ) {
    return await this.productService.updateProductPriceAndStock(userUuid, productId, updates);
  }
}
