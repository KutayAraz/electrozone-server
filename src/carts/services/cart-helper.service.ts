import { Injectable } from "@nestjs/common";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { User } from "src/entities/User.entity";
import { EntityManager } from "typeorm";
import { CartValidationService } from "./cart-validation.service";

@Injectable()
export class CartHelperService {
    constructor(private readonly cartValidationService: CartValidationService) { }

    async findOrCreateCart(userId: number, transactionManager: EntityManager): Promise<Cart> {
        const cart = await transactionManager.findOne(Cart, {
            where: { user: { id: userId } },
            relations: ['user'],
        });

        if (cart) return cart;

        const user = await transactionManager.findOne(User, { where: { id: userId } });
        
        this.cartValidationService.validateUser(user)

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
}