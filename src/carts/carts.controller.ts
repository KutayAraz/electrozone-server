import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CartsService } from "./carts.service";
import { AtGuard } from "src/common/guards";
import { GetCurrentUserId, Public } from "src/common/decorators";
import { CartItemDto } from "./dtos/cart-item.dto";
import { SkipThrottle } from "@nestjs/throttler";

@Controller("carts")
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Public()
  @SkipThrottle()
  @Post("local-cart")
  async getLocalCartInformation(@Body() localCartDto: CartItemDto[]) {
    return await this.cartsService.getLocalCartInformation(localCartDto);
  }

  @UseGuards(AtGuard)
  @Get("user-cart")
  async getUserCart(@GetCurrentUserId() id: number) {
    return await this.cartsService.getUserCart(id);
  }

  @UseGuards(AtGuard)
  @Post("buynow-cart")
  async getBuyNowCartInfo(@Body() cartItem: CartItemDto) {
    return await this.cartsService.getBuyNowCartInfo(
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @UseGuards(AtGuard)
  @Patch("merge-carts")
  async mergeCarts(
    @GetCurrentUserId() userId: number,
    @Body() cartItems: CartItemDto[],
  ) {
    return await this.cartsService.mergeLocalWithBackendCart(userId, cartItems);
  }

  @UseGuards(AtGuard)
  @SkipThrottle()
  @Patch("user-cart")
  async updateItemQuantity(
    @GetCurrentUserId() userId: number,
    @Body() cartItem: CartItemDto,
  ) {
    return await this.cartsService.updateCartItemQuantity(
      userId,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @UseGuards(AtGuard)
  @SkipThrottle()
  @Post("user-cart")
  async addItemToCart(
    @GetCurrentUserId() userId: number,
    @Body() cartItem: CartItemDto,
  ) {
    return await this.cartsService.addProductToCart(
      userId,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @UseGuards(AtGuard)
  @SkipThrottle()
  @Delete("user-cart")
  async removeItemFromCart(
    @GetCurrentUserId() userId: number,
    @Body("productId") productId: number,
  ) {
    return await this.cartsService.removeItemFromCart(userId, productId);
  }

  @UseGuards(AtGuard)
  @Delete("clear-cart")
  async clearCart(@GetCurrentUserId() userId: number) {
    return await this.cartsService.clearCart(userId);
  }
}
