import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AtGuard } from "src/common/guards";
import { GetCurrentUserId, Public } from "src/common/decorators";
import { CartItemDto } from "./dtos/cart-item.dto";
import { SkipThrottle } from "@nestjs/throttler";
import { CartOperationsService } from "./services/cart-operations.service";
import { CartService } from "./services/carts.service";
import { LocalCartService } from "./services/local-cart.service";

@Controller("carts")
export class CartController {
  constructor(
    private readonly cartOperationsService: CartOperationsService,
    private readonly cartsService: CartService,
    private readonly localCartService: LocalCartService
  ) { }

  @Public()
  @SkipThrottle()
  @Post("local")
  async getLocalCartInformation(@Body() localCartDto: CartItemDto[]) {
    return await this.localCartService.getLocalCartInformation(localCartDto);
  }

  @UseGuards(AtGuard)
  @Get("user")
  async getUserCart(@GetCurrentUserId() id: number) {
    return await this.cartsService.getUserCart(id);
  }

  @UseGuards(AtGuard)
  @Post("buy-now")
  async getBuyNowCartInfo(@Body() cartItem: CartItemDto) {
    return await this.localCartService.getBuyNowCartInfo(
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
    return await this.localCartService.mergeLocalWithBackendCart(userId, cartItems);
  }

  @UseGuards(AtGuard)
  @SkipThrottle()
  @Patch("user/item")
  async updateItemQuantity(
    @GetCurrentUserId() userId: number,
    @Body() cartItem: CartItemDto,
  ) {
    return await this.cartOperationsService.updateCartItemQuantity(
      userId,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @UseGuards(AtGuard)
  @SkipThrottle()
  @Post("user/item")
  async addProductToCart(
    @GetCurrentUserId() userId: number,
    @Body() cartItem: CartItemDto,
  ) {
    return await this.cartOperationsService.addProductToCart(
      userId,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @UseGuards(AtGuard)
  @SkipThrottle()
  @Delete("user/item/:productId")
  async removeCartItem(
    @GetCurrentUserId() userId: number,
    @Param("productId") productId: number,
  ) {
    return await this.cartsService.removeCartItem(userId, productId);
  }

  @UseGuards(AtGuard)
  @Delete("clear-cart")
  async clearCart(@GetCurrentUserId() userId: number) {
    return await this.cartsService.clearCart(userId);
  }
}
