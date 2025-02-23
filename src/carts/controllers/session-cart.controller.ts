import { Body, Controller, Delete, Get, Param, Patch, Post, Session } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "src/common/decorators/public.decorator";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { AddToCartDto } from "../dtos/add-to-cart.dto";
import { SessionCartService } from "../services/session-cart.service";
import { CartResponse } from "../types/cart-response.type";
import { QuantityChange } from "../types/quantity-change.type";

@Controller("cart/session")
export class SessionCartController {
  constructor(private readonly sessionCartService: SessionCartService) {}

  @Public()
  @Get()
  async getSessionCart(@Session() session: Record<string, any>): Promise<CartResponse> {
    return this.sessionCartService.getSessionCart(session.id);
  }

  @Public()
  @Post()
  async addToSessionCart(
    @Session() session: Record<string, any>,
    @Body() cartItem: AddToCartDto,
  ): Promise<QuantityChange> {
    return await this.sessionCartService.addToSessionCart(
      session.id,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @SkipThrottle()
  @Patch("item")
  async updateItemQuantity(
    @Session() session: Record<string, any>,
    @Body() cartItem: AddToCartDto,
  ): Promise<CartResponse> {
    return await this.sessionCartService.updateCartItemQuantity(
      session.id,
      cartItem.productId,
      cartItem.quantity,
    );
  }

  @Public()
  @Delete("item/:productId")
  async removeFromSessionCart(
    @Session() session: Record<string, any>,
    @Param("productId") productId: number,
  ): Promise<CartResponse> {
    return await this.sessionCartService.removeFromSessionCart(session.id, productId);
  }

  @Public()
  @Delete("clear")
  async clearSessionCart(@Session() session: Record<string, any>): Promise<CartResponse> {
    return await this.sessionCartService.clearSessionCart(session.id);
  }

  @Patch("merge")
  async mergeCarts(
    @UserUuid() userUuid: string,
    @Session() session: Record<string, any>,
  ): Promise<CartResponse> {
    return await this.sessionCartService.mergeCarts(userUuid, session.id);
  }
}
