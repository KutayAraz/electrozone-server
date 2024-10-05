import { Controller, Get, Post, Body, Patch, Delete, Param } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { AddToCartDto } from "../dtos/add-to-cart.dto";
import { CartService } from "../services/cart.service";
import { CartResponse } from "../types/cart-response.type";

@Controller("cart/user")
export class UserCartController {
    constructor(private readonly cartService: CartService) { }

    @Get()
    async getUserCart(@UserUuid() userUuid: string): Promise<CartResponse> {
        return await this.cartService.getUserCart(userUuid);
    }

    @SkipThrottle()
    @Post("item")
    async addProductToCart(
        @UserUuid() userUuid: string,
        @Body() cartItem: AddToCartDto,
    ): Promise<CartResponse> {
        return await this.cartService.addProductToCart(
            userUuid,
            cartItem.productId,
            cartItem.quantity,
        );
    }

    @SkipThrottle()
    @Patch("item")
    async updateItemQuantity(
        @UserUuid() userUuid: string,
        @Body() cartItem: AddToCartDto,
    ): Promise<CartResponse> {
        return await this.cartService.updateCartItemQuantity(
            userUuid,
            cartItem.productId,
            cartItem.quantity,
        );
    }

    @SkipThrottle()
    @Delete("item/:productId")
    async removeCartItem(
        @UserUuid() userUuid: string,
        @Param("productId") productId: number,
    ): Promise<CartResponse> {
        return await this.cartService.removeCartItem(userUuid, productId);
    }

    @Delete("clear")
    async clearCart(@UserUuid() userUuid: string): Promise<CartResponse> {
        return await this.cartService.clearCart(userUuid);
    }
}