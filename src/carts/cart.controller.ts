import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Session,
  Headers
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { CartOperationsService } from "./services/cart-operations.service";
import { CartService } from "./services/cart.service";
import { LocalCartService } from "./services/local-cart.service";
import { Public } from "src/common/decorators/public.decorator";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { SessionCartService } from "./services/session-cart.service";
import { AddToCartDto } from "./dtos/add-to-cart";

@Controller("cart")
export class CartController {
  constructor(
    private readonly cartOperationsService: CartOperationsService,
    private readonly cartsService: CartService,
    private readonly localCartService: LocalCartService,
    private readonly sessionCartService: SessionCartService
  ) { }

  // @Public()
  // @SkipThrottle()
  // @Post("local")
  // async getLocalCartInformation(@Body() localCartDto: AddToCartDto[]) {
  //   return await this.localCartService.getLocalCartInformation(localCartDto);
  // }

  @Get()
  async getUserCart(@UserUuid() userUuid: string) {
    return await this.cartsService.getUserCart(userUuid);
  }

  @Post("buy-now")
  async getBuyNowCartInfo(@Body() cartItem: AddToCartDto) {
    return await this.localCartService.getBuyNowCartInfo(
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @Patch("merge-carts")
  async mergeCarts(
    @UserUuid() userUuid: string,
    @Body() cartItems: AddToCartDto[],
  ) {
    return await this.localCartService.mergeLocalWithBackendCart(userUuid, cartItems);
  }

  @SkipThrottle()
  @Patch("user/item")
  async updateItemQuantity(
    @UserUuid() userUuid: string,
    @Body() cartItem: AddToCartDto,
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
    @Body() cartItem: AddToCartDto,
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

  @Public()
  @Get('session')
  async getSessionCart(@Session() session: Record<string, any>, @Headers() headers) {
    // console.log('Session data:', session);
    // console.log('Cookies:', headers.cookie);
    const sessionId = session.id;
    // console.log("Session ID:", sessionId);
    return this.sessionCartService.getSessionCart(sessionId);
  }

  @Public()
  @Post('session')
  async addToSessionCart(
    @Session() session: Record<string, any>,
    @Body('productId') productId: number,
    @Body('quantity') quantity: number,
    @Headers() headers
  ) {
    // console.log('Session data:', session);
    // console.log('Cookies:', headers.cookie);
    const sessionId = session.id;
    console.log("Session ID:", sessionId);
    return await this.sessionCartService.addToSessionCart(sessionId, productId, quantity);
  }

  @Public()
  @Delete('session/remove/:productId')
  async removeFromSessionCart(
    @Session() session: Record<string, any>,
    @Param('productId') productId: number,
  ) {
    const sessionId = session.id;
    await this.sessionCartService.removeFromSessionCart(sessionId, productId);
    return { message: 'Product removed from cart' };
  }
}
