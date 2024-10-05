import { Controller, Get, Post, Body, Delete, Param, Session, Patch } from "@nestjs/common";
import { Public } from "src/common/decorators/public.decorator";
import { AddToCartDto } from "../dtos/add-to-cart.dto";
import { SessionCartService } from "../services/session-cart.service";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { CartResponse } from "../types/cart-response.type";

@Controller("cart/session")
export class SessionCartController {
    constructor(private readonly sessionCartService: SessionCartService) {}

    @Public()
    @Get()
    async getSessionCart(@Session() session: Record<string, any>): Promise<CartResponse>  {
        return this.sessionCartService.getSessionCart(session.id);
    }

    @Public()
    @Post()
    async addToSessionCart(
        @Session() session: Record<string, any>,
        @Body() cartItem: AddToCartDto,
    ): Promise<CartResponse> {
        return await this.sessionCartService.addToSessionCart(
            session.id, 
            cartItem.productId, 
            cartItem.quantity
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
        @Session() session: Record<string, any>
    ): Promise<CartResponse> {
        return await this.sessionCartService.mergeCarts(userUuid, session.id);
    }
}