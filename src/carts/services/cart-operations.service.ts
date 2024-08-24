import { Injectable } from "@nestjs/common";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { DataSource, EntityManager } from "typeorm";
import { User } from "src/entities/User.entity";
import { CartHelperService } from "./cart-helper.service";
import { CartService } from "./carts.service";
import { CartValidationService } from "./cart-validation.service";
import { QuantityChange } from "../types/quantity-change.type";

@Injectable()
export class CartOperationsService {
    constructor(
        private readonly cartHelperService: CartHelperService,
        private readonly cartValidationService: CartValidationService,
        private readonly cartService: CartService,
        private readonly dataSource: DataSource,
    ) { }

    async addProductToCart(userId: number, productId: number, quantity: number, transactionalEntityManager?: EntityManager) {
        this.cartValidationService.validateQuantity(quantity)

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async transactionalEntityManager => {
            const [user, cart, foundProduct] = await Promise.all([
                transactionalEntityManager.findOne(User, { where: { id: userId } }),
                this.cartHelperService.findOrCreateCart(userId, transactionalEntityManager),
                transactionalEntityManager.findOne(Product, { where: { id: productId } })
            ]);

            this.cartValidationService.validateUser(user)
            this.cartValidationService.validateProduct(foundProduct)
            this.cartValidationService.validateStock(foundProduct)

            let cartItem = await transactionalEntityManager.findOne(CartItem, {
                where: { cart: cart, product: { id: productId } },
                relations: ["product"],
            });

            const currentQuantity = cartItem ? cartItem.quantity : 0;
            let newQuantity = Math.min(currentQuantity + quantity, 10, foundProduct.stock);
            const quantityChanges: QuantityChange[] = [];

            if (newQuantity !== currentQuantity + quantity) {
                quantityChanges.push({
                    productName: foundProduct.productName,
                    oldQuantity: currentQuantity + quantity,
                    newQuantity,
                    reason: newQuantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
                });
            }

            const quantityToAdd = newQuantity - currentQuantity;

            if (cartItem) {
                cartItem.quantity = newQuantity;
                cartItem.amount = newQuantity * foundProduct.price;
                cartItem.addedPrice = foundProduct.price;
            } else {
                cartItem = transactionalEntityManager.create(CartItem, {
                    product: foundProduct,
                    quantity: newQuantity,
                    amount: newQuantity * foundProduct.price,
                    cart: cart,
                    addedPrice: foundProduct.price
                });
            }

            cart.totalQuantity += quantityToAdd;
            cart.cartTotal = Number(cart.cartTotal) + Number(quantityToAdd * foundProduct.price);

            await transactionalEntityManager.save(cartItem);
            await transactionalEntityManager.save(cart);

            const updatedCart = await this.cartService.getUserCart(userId, transactionalEntityManager);

            return {
                ...updatedCart,
                quantityChanges
            };
        });
    }

    async updateCartItemQuantity(
        userId: number,
        productId: number,
        quantity: number,
        transactionalEntityManager?: EntityManager
    ) {
        this.cartValidationService.validateQuantity(quantity)

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            const [cart, cartItem] = await Promise.all([
                this.cartHelperService.findOrCreateCart(userId, transactionManager),
                transactionManager.findOne(CartItem, {
                    where: { cart: { user: { id: userId } }, product: { id: productId } },
                    relations: ["product"],
                })
            ]);

            if (cartItem) {
                this.cartValidationService.validateStockAvailability(cartItem.product, quantity)

                const oldQuantity = cartItem.quantity;
                const oldAmount = oldQuantity * cartItem.product.price;
                const newAmount = quantity * cartItem.product.price;

                cartItem.quantity = quantity;
                cartItem.amount = newAmount;

                cart.totalQuantity += quantity - oldQuantity;
                cart.cartTotal = Number(cart.cartTotal) + Number(newAmount) - Number(oldAmount);

                await transactionManager.save(cartItem);
                await transactionManager.save(cart);

                return await this.cartService.getUserCart(userId, transactionManager);
            } else {
                return await this.addProductToCart(userId, productId, quantity, transactionManager);
            }
        });
    }
}
