import { Injectable } from "@nestjs/common";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { DataSource, EntityManager } from "typeorm";
import { CartItemService } from "./cart-item.service";
import { CartResponse } from "../types/cart-response.type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartUtilityService } from "./cart-utility.service";

@Injectable()
export class CartService {
    constructor(
        private readonly cartItemService: CartItemService,
        private readonly cartUtilityService: CartUtilityService,
        private readonly commonValidationService: CommonValidationService,
        private readonly dataSource: DataSource
    ) { }

    async getUserCart(userUuid: string, transactionalEntityManager?: EntityManager): Promise<CartResponse> {
        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {

            let cart = await this.cartUtilityService.findOrCreateCart(userUuid, transactionManager);

            const { cartItems, removedCartItems, priceChanges, quantityChanges } =
                await this.cartItemService.fetchAndUpdateCartItems(cart.id, transactionManager);

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

    async removeCartItem(userUuid: string, productId: number) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const [cart, cartItemToRemove] = await Promise.all([
                this.cartUtilityService.findOrCreateCart(userUuid, transactionalEntityManager),
                transactionalEntityManager.findOne(CartItem, {
                    where: { cart: { user: { uuid: userUuid } }, product: { id: productId } },
                }),
            ]);

            this.commonValidationService.validateProduct(cartItemToRemove.product)

            this.commonValidationService.validateProduct(cartItemToRemove.product)

            cart.totalQuantity -= cartItemToRemove.quantity;
            cart.cartTotal = Number(cart.cartTotal) - Number(cartItemToRemove.amount);

            await transactionalEntityManager.save(cart);
            await transactionalEntityManager.remove(cartItemToRemove);

            return this.getUserCart(userUuid, transactionalEntityManager);
        });
    }

    async clearCart(userUuid: string) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const cart = await this.cartUtilityService.findOrCreateCart(userUuid, transactionalEntityManager);

            cart.cartTotal = 0;
            cart.totalQuantity = 0;
            cart.cartItems = [];

            await transactionalEntityManager.save(cart);
        });
    }
}