import { Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from "@nestjs/common";
import { WishlistService } from "../services/wishlist.service";
import { SkipThrottle } from "@nestjs/throttler";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { AtGuard } from "src/common/guards/at.guard";
import { WishlistItem } from "../types/wishlist-product.type";
import { WishlistToggleResult } from "../types/wishlist-toggle-result.type";

@Controller("wishlist")
export class WishlistController {
    constructor(private wishlistService: WishlistService) { }

    @Get()
    async getUserWishlist(@UserUuid() uuid: string): Promise<WishlistItem[]> {
        return await this.wishlistService.getUserWishlist(uuid);
    }

    @SkipThrottle()
    @Get(":productId/check")
    async checkWishlist(
        @Param("productId", ParseIntPipe) productId: number,
        @UserUuid() userUuid: string,
    ): Promise<boolean> {
        return await this.wishlistService.checkWishlist(
            productId,
            userUuid,
        );
    }

    @Patch(":productId/wishlist")
    async toggleWishlist(
        @Param("productId", ParseIntPipe) productId: number,
        @UserUuid() userUuid: string,
    ): Promise<WishlistToggleResult> {
        return await this.wishlistService.toggleWishlist(
            productId,
            userUuid,
        );
    }
}