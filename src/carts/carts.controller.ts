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
import { GetCurrentUserId } from "src/common/decorators";
import { CartItemDto } from "./dtos/cart-item.dto";

@Controller("carts")
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @UseGuards(AtGuard)
  @Get("user-cart")
  async getUserCart(@GetCurrentUserId() id: number) {
    return await this.cartsService.getUserCart(id);
  }

  @UseGuards(AtGuard)
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
  @Delete("user-cart")
  async removeItemFromCart(
    @GetCurrentUserId() userId: number,
    @Body("productId") productId: number,
  ) {
    return await this.cartsService.removeItemFromCart(
      userId,
      productId,
    );
  }

  @UseGuards(AtGuard)
  @Delete("clear-cart")
  async clearCart(@GetCurrentUserId() userId: number) {
    return await this.cartsService.clearCart(userId);
  }
}
