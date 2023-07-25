import { Body, Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get(":subcategory/productId")
  async getProduct(@Param("subcategory/product_name") product: string) {}
}
