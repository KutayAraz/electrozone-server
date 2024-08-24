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
import { ApiOperation } from "@nestjs/swagger";

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
  @ApiOperation({ summary: 'Get local cart information' })
  async getLocalCartInformation(@Body() localCartDto: CartItemDto[]) {
    return await this.localCartService.getLocalCartInformation(localCartDto);
  }

  @UseGuards(AtGuard)
  @Get("user")
  @ApiOperation({ summary: 'Get user cart' })
  async getUserCart(@GetCurrentUserId() id: number) {
    return await this.cartsService.getUserCart(id);
  }

  @UseGuards(AtGuard)
  @Post("buy-now")
  @ApiOperation({ summary: 'Get buy now cart info' })
  async getBuyNowCartInfo(@Body() cartItem: CartItemDto) {
    return await this.localCartService.getBuyNowCartInfo(
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @UseGuards(AtGuard)
  @Patch("merge-carts")
  @ApiOperation({ summary: 'Merge local cart with user cart' })
  async mergeCarts(
    @GetCurrentUserId() userId: number,
    @Body() cartItems: CartItemDto[],
  ) {
    return await this.localCartService.mergeLocalWithBackendCart(userId, cartItems);
  }

  @UseGuards(AtGuard)
  @SkipThrottle()
  @Patch("user/item")
  @ApiOperation({ summary: 'Update cart item quantity' })
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
  @ApiOperation({ summary: 'Add item to cart' })
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
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeCartItem(
    @GetCurrentUserId() userId: number,
    @Param("productId") productId: number,
  ) {
    return await this.cartsService.removeCartItem(userId, productId);
  }

  @UseGuards(AtGuard)
  @Delete("clear-cart")
  @ApiOperation({ summary: 'Clear user cart' })
  async clearCart(@GetCurrentUserId() userId: number) {
    return await this.cartsService.clearCart(userId);
  }
}
