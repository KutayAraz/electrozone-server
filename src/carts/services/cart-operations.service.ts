import { Injectable } from "@nestjs/common";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { DataSource, EntityManager } from "typeorm";
import { User } from "src/entities/User.entity";
import { CartService } from "./cart.service";
import { QuantityChange } from "../types/quantity-change.type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartUtilityService } from "./cart-utility.service";

@Injectable()
export class CartOperationsService {
    constructor(
        private readonly cartUtilityService: CartUtilityService,
        private readonly commonValidationService: CommonValidationService,
        private readonly cartService: CartService,
        private readonly dataSource: DataSource,
    ) { }

    async addProductToCart(userUuid: string, productId: number, quantity: number, transactionalEntityManager?: EntityManager) {
        this.commonValidationService.validateQuantity(quantity)

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async transactionalEntityManager => {
            const [user, cart, foundProduct] = await Promise.all([
                transactionalEntityManager.findOne(User, { where: { uuid: userUuid } }),
                this.cartUtilityService.findOrCreateCart(userUuid, transactionalEntityManager),
                transactionalEntityManager.findOne(Product, { where: { id: productId } })
            ]);

            this.commonValidationService.validateStock(foundProduct)
            this.commonValidationService.validateUser(user)
            this.commonValidationService.validateProduct(foundProduct)
            let cartItem = await transactionalEntityManager.findOne(CartItem, {
                where: { 
                    cart: { id: cart.id },
                    product: { id: productId }
                },
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

            const updatedCart = await this.cartService.getUserCart(userUuid, transactionalEntityManager);

            return {
                ...updatedCart,
                quantityChanges
            };
        });
    }

    async updateCartItemQuantity(
        userUuid: string,
        productId: number,
        quantity: number,
        transactionalEntityManager?: EntityManager
    ) {
        this.commonValidationService.validateQuantity(quantity)

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            const [cart, cartItem] = await Promise.all([
                this.cartUtilityService.findOrCreateCart(userUuid, transactionManager),
                transactionManager.findOne(CartItem, {
                    where: { cart: { user: { uuid: userUuid } }, product: { id: productId } },
                    relations: ["product"],
                })
            ]);

            if (cartItem) {
                this.commonValidationService.validateStockAvailability(cartItem.product, quantity)

                const oldQuantity = cartItem.quantity;
                const oldAmount = oldQuantity * cartItem.product.price;
                const newAmount = quantity * cartItem.product.price;

                cartItem.quantity = quantity;
                cartItem.amount = newAmount;

                cart.totalQuantity += quantity - oldQuantity;
                cart.cartTotal = Number(cart.cartTotal) + Number(newAmount) - Number(oldAmount);

                await transactionManager.save(cartItem);
                await transactionManager.save(cart);

                return await this.cartService.getUserCart(userUuid, transactionManager);
            } else {
                return await this.addProductToCart(userUuid, productId, quantity, transactionManager);
            }
        });
    }
}
