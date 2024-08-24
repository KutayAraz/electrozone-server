import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AtGuard } from "src/common/guards";
import { GetCurrentUserId, Public } from "src/common/decorators";
import { CartItemDto } from "./dtos/cart-item.dto";
import { SkipThrottle } from "@nestjs/throttler";
import { CartOperationsService } from "./services/cart-operations.service";
import { CartQueriesService } from "./services/cart-queries.service";

@Controller("carts")
export class CartsController {
  constructor(
    private readonly cartOperationsService: CartOperationsService,
    private readonly cartQueriesService: CartQueriesService
  ) { }

  @Public()
  @SkipThrottle()
  @Post("local-cart")
  async getLocalCartInformation(@Body() localCartDto: CartItemDto[]) {
    return await this.cartQueriesService.getLocalCartInformation(localCartDto);
  }

  @UseGuards(AtGuard)
  @Get("user-cart")
  async getUserCart(@GetCurrentUserId() id: number) {
    return await this.cartQueriesService.getUserCart(id);
  }

  @UseGuards(AtGuard)
  @Post("buynow-cart")
  async getBuyNowCartInfo(@Body() cartItem: CartItemDto) {
    return await this.cartQueriesService.getBuyNowCartInfo(
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
    return await this.cartOperationsService.mergeLocalWithBackendCart(userId, cartItems);
  }

  @UseGuards(AtGuard)
  @SkipThrottle()
  @Patch("user-cart")
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
  @Post("user-cart")
  async addItemToCart(
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
  @Delete("user-cart")
  async removeItemFromCart(
    @GetCurrentUserId() userId: number,
    @Body("productId") productId: number,
  ) {
    return await this.cartOperationsService.removeItemFromCart(userId, productId);
  }

  @UseGuards(AtGuard)
  @Delete("clear-cart")
  async clearCart(@GetCurrentUserId() userId: number) {
    return await this.cartOperationsService.clearCart(userId);
  }
}
