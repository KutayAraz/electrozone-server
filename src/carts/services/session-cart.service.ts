import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonValidationService } from 'src/common/services/common-validation.service';
import { CartItem } from 'src/entities/CartItem.entity';
import { Product } from 'src/entities/Product.entity';
import { SessionCart } from 'src/entities/SessionCart.entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CartItemService } from './cart-item.service';
import { CartUtilityService } from './cart-utility.service';
import { CartService } from './cart.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorType } from 'src/common/errors/error-type';

@Injectable()
export class SessionCartService {
    constructor(
        @InjectRepository(SessionCart)
        private sessionCartRepository: Repository<SessionCart>,
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        private readonly commonValidationService: CommonValidationService,
        private readonly cartItemService: CartItemService,
        private readonly cartUtilityService: CartUtilityService,
        private readonly cartService: CartService,
        private readonly dataSource: DataSource,
    ) { }

    async getSessionCart(sessionId: string, transactionalEntityManager?: EntityManager) {
        this.commonValidationService.validateSessionId(sessionId)
        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            let cart = await this.cartUtilityService.findOrCreateSessionCart(sessionId, transactionManager);

            // Update the cart items and notify user of any changes to product price or stock change
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

    async addToSessionCart(sessionId: string, productId: number, quantity: number, transactionalEntityManager?: EntityManager) {
        this.commonValidationService.validateSessionId(sessionId)
        this.commonValidationService.validateQuantity(quantity);

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            const [sessionCart, product] = await Promise.all([
                this.cartUtilityService.findOrCreateSessionCart(sessionId, transactionManager),
                this.productRepository.findOne({ where: { id: productId } })
            ]);

            const { quantityChanges } = await this.cartItemService.addCartItem(
                sessionCart,
                product,
                quantity,
                transactionManager
            );

            // Return the final version of the cart
            const updatedCart = await this.getSessionCart(sessionId, transactionalEntityManager);
            return { ...updatedCart, quantityChanges };
        });
    }

    async updateCartItemQuantity(
        sessionId: string,
        productId: number,
        quantity: number,
        transactionalEntityManager?: EntityManager
    ) {
        this.commonValidationService.validateSessionId(sessionId)
        this.commonValidationService.validateQuantity(quantity)

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            // Find both session cart and cartItem in parallel execution
            const [sessionCart, cartItem] = await Promise.all([
                this.cartUtilityService.findOrCreateSessionCart(sessionId, transactionManager),
                transactionManager.findOne(CartItem, {
                    where: { sessionCart: { sessionId }, product: { id: productId } },
                    relations: ["product"],
                })
            ]);

            // If cartItem exists, update its quantity
            if (cartItem) {
                if (cartItem) {
                    await this.cartItemService.updateCartItemQuantity(
                        sessionCart,
                        cartItem,
                        quantity,
                        transactionManager
                    );
                } else {
                    // If cartItem doesn't exist, treat it as a new item addition
                    const product = await this.productRepository.findOne({
                        where: { id: productId }
                    });
                    await this.cartItemService.addCartItem(
                        sessionCart,
                        product,
                        quantity,
                        transactionManager
                    );
                }
                // Return updated cart information
                return await this.getSessionCart(sessionId, transactionManager);
            }
        });
    }

    async removeFromSessionCart(sessionId: string, productId: number) {
        this.commonValidationService.validateSessionId(sessionId)

        return this.dataSource.transaction(async (transactionManager) => {
            const [sessionCart, cartItem] = await Promise.all([
                this.cartUtilityService.findOrCreateSessionCart(sessionId, transactionManager),
                transactionManager.findOne(CartItem, {
                    where: {
                        sessionCart: { sessionId },
                        product: { id: productId }
                    },
                    relations: ["product"]
                })
            ]);

            if (cartItem) {
                await this.cartItemService.removeCartItem(
                    sessionCart,
                    cartItem,
                    transactionManager
                );
            } else {
                throw new AppError(ErrorType.CART_ITEM_NOT_FOUND, "This product is already not in your cart")
            }

            return this.getSessionCart(sessionId, transactionManager);
        });
    }

    async mergeCarts(sessionId: string, userUuid: string) {
        this.commonValidationService.validateSessionId(sessionId)

        return this.dataSource.transaction(async transactionalEntityManager => {
            // First, check if a session cart exists
            const existingSessionCart = await transactionalEntityManager.findOne(SessionCart, {
                where: { sessionId },
                relations: ['cartItems', 'cartItems.product']
            });

            // If no session cart exists or it has no items, just return the user cart
            if (!existingSessionCart || existingSessionCart.cartItems.length === 0) {
                return await this.cartService.getUserCart(userUuid, transactionalEntityManager);
            }

            // Since we have items to merge, get or create the user cart
            const userCart = await this.cartUtilityService.findOrCreateCart(
                userUuid,
                transactionalEntityManager
            );

            // Create a map of existing items in the user's cart for quick lookup
            const existingItemsMap = new Map<number, CartItem>();
            userCart.cartItems.forEach((item) => {
                existingItemsMap.set(item.product.id, item);
            });

            for (const sessionCartItem of existingSessionCart.cartItems) {
                // Check if the product already exists in the user's cart
                const existingProduct = existingItemsMap.get(sessionCartItem.product.id);

                if (existingProduct) {
                    // If the product exists, update the quantity
                    const newQuantity = sessionCartItem.quantity + existingProduct.quantity;
                    await this.cartService.updateCartItemQuantity(
                        userUuid,
                        sessionCartItem.id,
                        newQuantity,
                        transactionalEntityManager
                    );
                } else {
                    // If the product doesn't exist, add it to the user's cart
                    await this.cartService.addProductToCart(
                        userUuid,
                        sessionCartItem.id,
                        sessionCartItem.quantity,
                        transactionalEntityManager
                    );
                }
            }

            // Clean up: Delete the session cart and its items after merging
            await transactionalEntityManager.delete(CartItem, {
                sessionCart: { id: existingSessionCart.id }
            });
            await transactionalEntityManager.delete(SessionCart, {
                id: existingSessionCart.id
            });
            // Return the updated user cart
            return await this.cartService.getUserCart(userUuid, transactionalEntityManager);
        });
    }

    async clearSessionCart(sessionId: string, transactionalEntityManager?: EntityManager) {
        this.commonValidationService.validateSessionId(sessionId);

        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {
            // Find or create the session cart
            const sessionCart = await this.cartUtilityService.findOrCreateSessionCart(
                sessionId,
                transactionManager
            );

            // Delete all cart items first
            await transactionManager.delete(CartItem, {
                sessionCart: { id: sessionCart.id }
            });

            // Reset the cart totals
            sessionCart.cartTotal = 0;
            sessionCart.totalQuantity = 0;

            // Save the updated cart
            await transactionManager.save(sessionCart);

            return {
                cartTotal: 0,
                totalQuantity: 0,
                cartItems: []
            };
        });
    }
}