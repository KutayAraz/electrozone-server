import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Session,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { CartService } from "./services/cart.service";
import { Public } from "src/common/decorators/public.decorator";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { SessionCartService } from "./services/session-cart.service";
import { AddToCartDto } from "./dtos/add-to-cart";

@Controller("cart")
export class CartController {
  constructor(
    private readonly cartsService: CartService,
    private readonly sessionCartService: SessionCartService
  ) {}

  // User Cart Operations
  @Get()
  async getUserCart(@UserUuid() userUuid: string) {
    return await this.cartsService.getUserCart(userUuid);
  }

  @SkipThrottle()
  @Post("user/item")
  async addProductToCart(
    @UserUuid() userUuid: string,
    @Body() cartItem: AddToCartDto,
  ) {
    return await this.cartsService.addProductToCart(
      userUuid,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @SkipThrottle()
  @Patch("user/item")
  async updateItemQuantity(
    @UserUuid() userUuid: string,
    @Body() cartItem: AddToCartDto,
  ) {
    return await this.cartsService.updateCartItemQuantity(
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

  @Delete("user/clear")
  async clearCart(@UserUuid() userUuid: string) {
    return await this.cartsService.clearCart(userUuid);
  }

  // Session Cart Operations
  @Public()
  @Get('session')
  async getSessionCart(@Session() session: Record<string, any>) {
    return this.sessionCartService.getSessionCart(session.id);
  }

  @Public()
  @Post('session')
  async addToSessionCart(
    @Session() session: Record<string, any>,
    @Body() cartItem: AddToCartDto,
  ) {
    return await this.sessionCartService.addToSessionCart(session.id, cartItem.productId, cartItem.quantity);
  }

  @Public()
  @Delete('session/item/:productId')
  async removeFromSessionCart(
    @Session() session: Record<string, any>,
    @Param('productId') productId: number,
  ) {
    return await this.sessionCartService.removeFromSessionCart(session.id, productId);
  }

  @Public()
  @Delete('session/clear')
  async clearSessionCart(
    @Session() session: Record<string, any>,
  ) {
    return await this.sessionCartService.clearSessionCart(session.id);
  }

  // Merge Carts
  @Patch("merge")
  async mergeCarts(
    @UserUuid() userUuid: string,
    @Session() session: Record<string, any>
  ) {
    return await this.sessionCartService.mergeCarts(userUuid, session.id);
  }
}