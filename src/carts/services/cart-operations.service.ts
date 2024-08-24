import { Injectable, Logger } from "@nestjs/common";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { DataSource, EntityManager } from "typeorm";
import { Cart } from "src/entities/Cart.entity";
import { User } from "src/entities/User.entity";
import { CartItemDto } from "../dtos/cart-item.dto";
import QuantityChange from "../types/quantity-change.type";
import { FormattedCartProduct } from "../types/formatted-cart-product.type";
import { PriceChange } from "../types/price-change.type";
import { CartCalculationsService } from "./cart-calculations.service";
import { CartQueriesService } from "./cart-queries.service";

@Injectable()
export class CartOperationsService {
    constructor(
        private readonly cartCalculationsService: CartCalculationsService,
        private readonly cartQueriesService: CartQueriesService,
        private dataSource: DataSource,
    ) { }

    async findOrCreateCart(userId: number, transactionManager: EntityManager): Promise<Cart> {
        const cart = await transactionManager.findOne(Cart, {
            where: { user: { id: userId } },
            relations: ['user'],
        });

        if (cart) return cart;

        const user = await transactionManager.findOne(User, { where: { id: userId } });
        if (!user) throw new AppError(ErrorType.USER_NOT_FOUND, userId, 'User');

        const newCart = transactionManager.create(Cart, {
            user,
            cartTotal: 0,
            totalQuantity: 0,
        });
        return await transactionManager.save(newCart);
    }

    async addProductToCart(userId: number, productId: number, quantity: number, transactionalEntityManager?: EntityManager) {
        if (quantity > 10) {
            throw new AppError(ErrorType.QUANTITY_LIMIT_EXCEEDED);
        }
        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async transactionalEntityManager => {
            const [user, cart, foundProduct] = await Promise.all([
                transactionalEntityManager.findOne(User, { where: { id: userId } }),
                this.findOrCreateCart(userId, transactionalEntityManager),
                transactionalEntityManager.findOne(Product, { where: { id: productId } })
            ]);

            if (!user) throw new AppError(ErrorType.USER_NOT_FOUND);
            if (!foundProduct) throw new AppError(ErrorType.PRODUCT_NOT_FOUND);
            if (foundProduct.stock <= 0) throw new AppError(ErrorType.OUT_OF_STOCK);

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

            const updatedCart = await this.cartQueriesService.getUserCart(userId, transactionalEntityManager);

            return {
                ...updatedCart,
                quantityChanges
            };
        });
    }

    async fetchAndUpdateCartProducts(cartId: number, transactionManager: EntityManager): Promise<{
        products: FormattedCartProduct[],
        removedItems: string[],
        priceChanges: PriceChange[],
        quantityChanges: QuantityChange[]
    }> {
        const cartItems = await this.cartQueriesService.getCartItemsWithProducts(cartId, transactionManager);

        const formattedProducts: FormattedCartProduct[] = [];
        const removedItems: string[] = [];
        const priceChanges: PriceChange[] = [];
        const quantityChanges: QuantityChange[] = [];

        await Promise.all(cartItems.map(async (item) => {
            if (item.product.stock > 0) {
                const { updatedItem, quantityChange, priceChange } =
                    await this.cartCalculationsService.updateCartItem(item, transactionManager);

                formattedProducts.push(this.cartCalculationsService.formatCartProduct(updatedItem));
                if (quantityChange) quantityChanges.push(quantityChange);
                if (priceChange) priceChanges.push(priceChange);
            } else {
                await transactionManager.delete(CartItem, item.id);
                removedItems.push(item.product.productName);
            }
        }));

        return { products: formattedProducts, removedItems, priceChanges, quantityChanges };
    }

    async updateCartItemQuantity(
        userId: number,
        productId: number,
        quantity: number,
        transactionalEntityManager?: EntityManager
    ) {
        if (quantity > 10) {
            throw new AppError(ErrorType.QUANTITY_LIMIT_EXCEEDED);
        }

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            const [cart, cartItem] = await Promise.all([
                this.findOrCreateCart(userId, transactionManager),
                transactionManager.findOne(CartItem, {
                    where: { cart: { user: { id: userId } }, product: { id: productId } },
                    relations: ["product"],
                })
            ]);

            if (cartItem) {
                if (quantity > cartItem.product.stock) {
                    throw new AppError(ErrorType.STOCK_LIMIT_EXCEEDED, productId, cartItem.product.productName);
                }

                const oldQuantity = cartItem.quantity;
                const oldAmount = oldQuantity * cartItem.product.price;
                const newAmount = quantity * cartItem.product.price;

                cartItem.quantity = quantity;
                cartItem.amount = newAmount;

                cart.totalQuantity += quantity - oldQuantity;
                cart.cartTotal = Number(cart.cartTotal) + Number(newAmount) - Number(oldAmount);

                await transactionManager.save(cartItem);
                await transactionManager.save(cart);

                return await this.cartQueriesService.getUserCart(userId, transactionManager);
            } else {
                return await this.addProductToCart(userId, productId, quantity, transactionManager);
            }
        });
    }

    async mergeLocalWithBackendCart(userId: number, localCartItems: CartItemDto[]) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const cart = await this.findOrCreateCart(userId, transactionalEntityManager);

            const existingItemsMap = new Map<number, CartItem>();
            cart.cartItems.forEach((item) => {
                existingItemsMap.set(item.product.id, item);
            });

            for (const localItem of localCartItems) {
                const existingProduct = existingItemsMap.get(localItem.productId);

                if (existingProduct) {
                    const newQuantity = localItem.quantity + existingProduct.quantity;
                    await this.updateCartItemQuantity(
                        userId,
                        localItem.productId,
                        newQuantity,
                        transactionalEntityManager
                    );
                } else {
                    await this.addProductToCart(
                        userId,
                        localItem.productId,
                        localItem.quantity,
                        transactionalEntityManager
                    );
                }
            }

            return await this.cartQueriesService.getUserCart(userId, transactionalEntityManager);
        });
    }

    async removeItemFromCart(userId: number, productId: number) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const [cart, productToRemove] = await Promise.all([
                this.findOrCreateCart(userId, transactionalEntityManager),
                transactionalEntityManager.findOne(CartItem, {
                    where: { cart: { user: { id: userId } }, product: { id: productId } },
                }),
            ]);

            if (!productToRemove) {
                throw new AppError(ErrorType.PRODUCT_NOT_FOUND);
            }

            cart.totalQuantity -= productToRemove.quantity;
            cart.cartTotal = Number(cart.cartTotal) - Number(productToRemove.amount);

            await transactionalEntityManager.save(cart);
            await transactionalEntityManager.remove(productToRemove);

            return this.cartQueriesService.getUserCart(userId, transactionalEntityManager);
        });
    }

    async clearCart(userId: number) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const cart = await this.findOrCreateCart(userId, transactionalEntityManager);

            cart.cartTotal = 0;
            cart.totalQuantity = 0;
            cart.cartItems = [];

            await transactionalEntityManager.save(cart);
        });
    }
}
