import { Controller, Post, Body, Get, Delete, Session } from "@nestjs/common";
import { Public } from "src/common/decorators/public.decorator";
import { BuyNowProductDto } from "../dtos/buy-now-product.dto";
import { BuyNowCartService } from "../services/buy-now-cart.service";
import { CartResponse } from "../types/cart-response.type";

@Controller("cart/buy-now")
export class BuyNowCartController {
  constructor(private readonly buyNowCartService: BuyNowCartService) {}

  @Public()
  @Post()
  async createBuyNowCart(
    @Session() session: Record<string, any>,
    @Body() buyNowDto: BuyNowProductDto,
  ): Promise<void> {
    return await this.buyNowCartService.createBuyNowCart(
      session.id,
      buyNowDto.productId,
      buyNowDto.quantity,
    );
  }

  @Public()
  @Get()
  async getBuyNowCart(@Session() session: Record<string, any>): Promise<CartResponse> {
    return await this.buyNowCartService.getBuyNowCart(session.id);
  }

  @Public()
  @Delete()
  async clearBuyNowCart(@Session() session: Record<string, any>): Promise<void> {
    return await this.buyNowCartService.clearBuyNowCart(session.id);
  }
}
