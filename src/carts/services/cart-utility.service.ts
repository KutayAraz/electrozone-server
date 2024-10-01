import { Injectable } from "@nestjs/common";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { User } from "src/entities/User.entity";
import { EntityManager } from "typeorm";
import { CommonValidationService } from "src/common/services/common-validation.service";

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
    
    async getCartItems(cartId: number, transactionManager: EntityManager) {
        return transactionManager
            .createQueryBuilder(CartItem, "cartItem")
            .select([
                "cartItem.id", "cartItem.quantity", "cartItem.amount", "cartItem.addedPrice",
                "product.productName", "product.averageRating", "product.thumbnail",
                "product.price", "product.id", "product.stock",
                "subcategory.subcategory", "category.category",
            ])
            .innerJoin("cartItem.product", "product")
            .innerJoin("product.subcategory", "subcategory")
            .innerJoin("subcategory.category", "category")
            .where("cartItem.cartId = :cartId", { cartId })
            .getMany();
    }

    async getSessionCartItems(sessionCartId: number, transactionManager: EntityManager) {
        return transactionManager
            .createQueryBuilder(CartItem, "cartItem")
            .select([
                "cartItem.id", "cartItem.quantity", "cartItem.amount", "cartItem.addedPrice",
                "product.productName", "product.averageRating", "product.thumbnail",
                "product.price", "product.id", "product.stock",
                "subcategory.subcategory", "category.category",
            ])
            // .innerJoin("cartItem.sessionCart", "sessionCart")
            .innerJoin("cartItem.product", "product")
            .innerJoin("product.subcategory", "subcategory")
            .innerJoin("subcategory.category", "category")
            .where("cartItem.sessionCartId = :sessionCartId", { sessionCartId })
            .getMany();
    }
}