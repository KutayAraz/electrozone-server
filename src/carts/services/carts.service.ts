import { Injectable } from "@nestjs/common";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { DataSource, EntityManager } from "typeorm";
import { CartItemService } from "./cart-item.service";
import { CartHelperService } from "./cart-helper.service";
import { CartValidationService } from "./cart-validation.service";
import { CartResponse } from "../types/cart-response.type";

@Injectable()
export class CartService {
    constructor(
        private readonly cartItemService: CartItemService,
        private readonly cartHelperService: CartHelperService,
        private readonly cartValidationService: CartValidationService,
        private readonly dataSource: DataSource
    ) { }

    async getUserCart(userId: number, transactionalEntityManager?: EntityManager): Promise<CartResponse> {
        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {

            let cart = await this.cartHelperService.findOrCreateCart(userId, transactionManager);

            const { cartItems, removedCartItems, priceChanges, quantityChanges } = await this.cartItemService.fetchAndUpdateCartItems(cart.id, transactionManager);

            // Recalculate cart total and quantity
            const cartTotal = cartItems.reduce((total, product) => total + product.amount, 0);
            const totalQuantity = cartItems.reduce((total, product) => total + product.quantity, 0);

            // Update cart in database
            await transactionManager.update(Cart, cart.id, { cartTotal, totalQuantity });

            return {
                cartTotal,
                totalQuantity,
                cartItems,
                removedCartItems,
                priceChanges,
                quantityChanges,
            };
        });
    }

    async removeCartItem(userId: number, productId: number) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const [cart, cartItemToRemove] = await Promise.all([
                this.cartHelperService.findOrCreateCart(userId, transactionalEntityManager),
                transactionalEntityManager.findOne(CartItem, {
                    where: { cart: { user: { id: userId } }, product: { id: productId } },
                }),
            ]);

            this.cartValidationService.validateProduct(cartItemToRemove.product)

            this.cartValidationService.validateCartItem(cartItemToRemove)

            cart.totalQuantity -= cartItemToRemove.quantity;
            cart.cartTotal = Number(cart.cartTotal) - Number(cartItemToRemove.amount);

            await transactionalEntityManager.save(cart);
            await transactionalEntityManager.remove(cartItemToRemove);

            return this.getUserCart(userId, transactionalEntityManager);
        });
    }

    async clearCart(userId: number) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const cart = await this.cartHelperService.findOrCreateCart(userId, transactionalEntityManager);

            cart.cartTotal = 0;
            cart.totalQuantity = 0;
            cart.cartItems = [];

            await transactionalEntityManager.save(cart);
        });
    }
}