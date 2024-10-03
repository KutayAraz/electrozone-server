import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonValidationService } from 'src/common/services/common-validation.service';
import { CartItem } from 'src/entities/CartItem.entity';
import { Product } from 'src/entities/Product.entity';
import { SessionCart } from 'src/entities/SessionCart.entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { QuantityChange } from '../types/quantity-change.type';
import { ErrorType } from 'src/common/errors/error-type';
import { CartItemService } from './cart-item.service';
import { AddToCartDto } from '../dtos/add-to-cart';
import { CartUtilityService } from './cart-utility.service';
import { CartOperationsService } from './cart-operations.service';
import { CartService } from './cart.service';

@Injectable()
export class SessionCartService {
    constructor(
        @InjectRepository(SessionCart)
        private sessionCartRepository: Repository<SessionCart>,
        @InjectRepository(CartItem)
        private cartItemRepository: Repository<CartItem>,
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        private readonly commonValidationService: CommonValidationService,
        private readonly cartItemService: CartItemService,
        private readonly cartUtilityService: CartUtilityService,
        private readonly cartOperationsService: CartOperationsService,
        private readonly cartService: CartService,
        private readonly dataSource: DataSource,
    ) { }

    async findOrCreateSessionCart(sessionId: string, transactionManager: EntityManager): Promise<SessionCart> {
        const sessionCart = await transactionManager.findOne(SessionCart, { where: { sessionId } });

        if (sessionCart) return sessionCart;

        const newSessionCart = transactionManager.create(SessionCart, { sessionId });
        await this.sessionCartRepository.save(newSessionCart);

        return await transactionManager.save(newSessionCart)
    }

    async updateCartItemQuantity(
        sessionId: string,
        productId: number,
        quantity: number,
        transactionalEntityManager?: EntityManager
    ) {
        this.commonValidationService.validateQuantity(quantity)

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            const [cart, cartItem] = await Promise.all([
                this.findOrCreateSessionCart(sessionId, transactionManager),
                transactionManager.findOne(CartItem, {
                    where: { sessionCart: { sessionId }, product: { id: productId } },
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

                return await this.getSessionCart(sessionId, transactionManager);
            } else {
                return await this.addToSessionCart(sessionId, productId, quantity, transactionManager);
            }
        });
    }

    async addToSessionCart(sessionId: string, productId: number, quantity: number, transactionalEntityManager?: EntityManager): Promise<{
        cart: SessionCart,
        quantityChanges: QuantityChange[]
    }> {
        this.commonValidationService.validateQuantity(quantity);

        return this.dataSource.transaction(async (transactionalEntityManager) => {
            const sessionCart = await this.findOrCreateSessionCart(sessionId, transactionalEntityManager);
            const product = await this.productRepository.findOne({ where: { id: productId } });

            this.commonValidationService.validateProduct(product);

            let cartItem = await this.cartItemRepository.findOne({
                where: { sessionCart: { id: sessionCart.id }, product: { id: productId } },
            });

            const currentQuantity = cartItem ? cartItem.quantity : 0;
            let newQuantity = Math.min(currentQuantity + quantity, 10, product.stock);
            const quantityChanges: QuantityChange[] = [];

            if (newQuantity !== currentQuantity + quantity) {
                quantityChanges.push({
                    productName: product.productName,
                    oldQuantity: currentQuantity + quantity,
                    newQuantity,
                    reason: newQuantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
                });
            }

            const quantityToAdd = newQuantity - currentQuantity;

            if (cartItem) {
                cartItem.quantity = newQuantity;
                cartItem.amount = newQuantity * product.price;
                cartItem.addedPrice = product.price;
            } else {
                cartItem = this.cartItemRepository.create({
                    sessionCart,
                    product,
                    quantity: newQuantity,
                    amount: newQuantity * product.price,
                    addedPrice: product.price
                });
            }

            sessionCart.totalQuantity += quantityToAdd;
            sessionCart.cartTotal = Number(sessionCart.cartTotal) + Number(quantityToAdd * product.price);

            await transactionalEntityManager.save(cartItem);
            await transactionalEntityManager.save(sessionCart);

            return { cart: sessionCart, quantityChanges };
        });
    }

    async removeFromSessionCart(sessionId: string, productId: number): Promise<void> {
        return this.dataSource.transaction(async (transactionalEntityManager) => {
            const sessionCart = await this.findOrCreateSessionCart(sessionId, transactionalEntityManager);
            await this.cartItemRepository.delete({
                sessionCart: { id: sessionCart.id },
                product: { id: productId },
            });
            await this.updateSessionCartTotals(sessionCart.id);
        })
    }

    async updateSessionCartTotals(sessionCartId: number): Promise<void> {
        const sessionCart = await this.sessionCartRepository.findOne({
            where: { id: sessionCartId },
            relations: ['cartItems'],
        });

        if (sessionCart) {
            sessionCart.totalQuantity = sessionCart.cartItems.reduce((sum, item) => sum + item.quantity, 0);
            sessionCart.cartTotal = sessionCart.cartItems.reduce((sum, item) => sum + item.amount, 0);
            await this.sessionCartRepository.save(sessionCart);
        }
    }

    async getSessionCart(sessionId: string, transactionalEntityManager?: EntityManager) {
        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            let cart = await this.findOrCreateSessionCart(sessionId, transactionManager);
            console.log("cart id is ", cart.id)
            const { cartItems, removedCartItems, priceChanges, quantityChanges } =
                await this.cartItemService.fetchAndUpdateCartItems(transactionManager, { sessionCartId: cart.id });

            // Recalculate cart total and quantity
            const cartTotal = cartItems.reduce((total, product) => total + product.amount, 0);
            const totalQuantity = cartItems.reduce((total, product) => total + product.quantity, 0);

            // Update cart in database
            await transactionManager.update(SessionCart, cart.id, { cartTotal, totalQuantity });

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

    async mergeLocalWithBackendCart(sessionId: string, userUuid: string) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const sessionCart = await this.findOrCreateSessionCart(sessionId, transactionalEntityManager);
            const userCart = await this.cartUtilityService.findOrCreateCart(sessionId, transactionalEntityManager);

            const existingItemsMap = new Map<number, CartItem>();
            userCart.cartItems.forEach((item) => {
                existingItemsMap.set(item.product.id, item);
            });

            for (const sessionCartItem of sessionCart.cartItems) {
                const existingProduct = existingItemsMap.get(sessionCartItem.id);

                if (existingProduct) {
                    const newQuantity = sessionCartItem.quantity + existingProduct.quantity;
                    await this.cartOperationsService.updateCartItemQuantity(
                        userUuid,
                        sessionCartItem.id,
                        newQuantity,
                        transactionalEntityManager
                    );
                } else {
                    await this.cartOperationsService.addProductToCart(
                        userUuid,
                        sessionCartItem.id,
                        sessionCartItem.quantity,
                        transactionalEntityManager
                    );
                }
            }

            return await this.cartService.getUserCart(userUuid, transactionalEntityManager);
        });
    }
}