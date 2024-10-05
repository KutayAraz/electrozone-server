import { Injectable } from "@nestjs/common";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { User } from "src/entities/User.entity";
import { EntityManager } from "typeorm";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { FormattedCartItem } from "../types/formatted-cart-product.type";
import { SessionCart } from "src/entities/SessionCart.entity";

@Injectable()
export class CartUtilityService {
    constructor(
        private readonly commonValidationService: CommonValidationService
    ) { }

    async findOrCreateCart(userUuid: string, transactionManager: EntityManager): Promise<Cart> {
        const cart = await transactionManager.findOne(Cart, {
            where: { user: { uuid: userUuid } },
            relations: ['user'],
        });

        if (cart) return cart;

        const user = await transactionManager.findOne(User, { where: { uuid: userUuid } });

        this.commonValidationService.validateUser(user)

        const newCart = transactionManager.create(Cart, {
            user,
            cartTotal: 0,
            totalQuantity: 0,
        });
        return await transactionManager.save(newCart);
    }

    async findOrCreateSessionCart(sessionId: string, transactionManager: EntityManager): Promise<SessionCart> {
        const sessionCart = await transactionManager.findOne(SessionCart, { where: { sessionId } });

        if (sessionCart) return sessionCart;

        const newSessionCart = transactionManager.create(SessionCart, {
            sessionId,
            cartTotal: 0,
            totalQuantity: 0
        });
        return await transactionManager.save(newSessionCart);
    }

    async getCartItems(cartId: number, isSessionCart: boolean, transactionManager: EntityManager) {
        const queryBuilder = transactionManager
            .createQueryBuilder(CartItem, "cartItem")
            .select([
                "cartItem.id", "cartItem.quantity", "cartItem.amount", "cartItem.addedPrice",
                "product.productName", "product.averageRating", "product.thumbnail",
                "product.price", "product.id", "product.stock",
                "subcategory.subcategory", "category.category",
            ])
            .innerJoin("cartItem.product", "product")
            .innerJoin("product.subcategory", "subcategory")
            .innerJoin("subcategory.category", "category");

        if (isSessionCart) {
            queryBuilder.where("cartItem.sessionCartId = :cartId", { cartId });
        } else {
            queryBuilder.where("cartItem.cartId = :cartId", { cartId });
        }

        return queryBuilder.getMany();
    }

    formatCartItem(item: CartItem): FormattedCartItem {
        return {
            cartItemId: item.id,
            quantity: item.quantity,
            amount: item.product.price * item.quantity,
            id: item.product.id,
            productName: item.product.productName,
            avgRating: item.product.averageRating,
            thumbnail: item.product.thumbnail,
            price: item.product.price,
            subcategory: item.product.subcategory.subcategory,
            category: item.product.subcategory.category.category,
        };
    }
}