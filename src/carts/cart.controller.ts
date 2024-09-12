import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CartItemDto } from "./dtos/cart-item.dto";
import { SkipThrottle } from "@nestjs/throttler";
import { CartOperationsService } from "./services/cart-operations.service";
import { CartService } from "./services/cart.service";
import { LocalCartService } from "./services/local-cart.service";
import { Public } from "src/common/decorators/public.decorator";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";

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

  @Get("user")
  async getUserCart(@UserUuid() userUuid: string) {
    return await this.cartsService.getUserCart(userUuid);
  }

  @Post("buy-now")
  async getBuyNowCartInfo(@Body() cartItem: CartItemDto) {
    return await this.localCartService.getBuyNowCartInfo(
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @Patch("merge-carts")
  async mergeCarts(
    @UserUuid() userUuid: string,
    @Body() cartItems: CartItemDto[],
  ) {
    return await this.localCartService.mergeLocalWithBackendCart(userUuid, cartItems);
  }

  @SkipThrottle()
  @Patch("user/item")
  async updateItemQuantity(
    @UserUuid() userUuid: string,
    @Body() cartItem: CartItemDto,
  ) {
    return await this.cartOperationsService.updateCartItemQuantity(
      userUuid,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @SkipThrottle()
  @Post("user/item")
  async addProductToCart(
    @UserUuid() userUuid: string,
    @Body() cartItem: CartItemDto,
  ) {
    return await this.cartOperationsService.addProductToCart(
      userUuid,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @SkipThrottle()
  @Delete("user/item/:productId")
  async removeCartItem(
    @UserUuid() userUuid: string,
    @Param("productId") productId: number,
  ) {
    return await this.cartsService.removeCartItem(userUuid, productId);
  }

  @Delete("clear-cart")
  async clearCart(@UserUuid() userUuid: string) {
    return await this.cartsService.clearCart(userUuid);
  }
}
