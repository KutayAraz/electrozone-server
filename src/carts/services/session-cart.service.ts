import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonValidationService } from 'src/common/services/common-validation.service';
import { CartItem } from 'src/entities/CartItem.entity';
import { Product } from 'src/entities/Product.entity';
import { SessionCart } from 'src/entities/SessionCart.entity';
import { DataSource, Repository } from 'typeorm';
import { QuantityChange } from '../types/quantity-change.type';
import { ErrorType } from 'src/common/errors/error-type';

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
        private readonly dataSource: DataSource
    ) { }

    async getOrCreateSessionCart(sessionId: string): Promise<SessionCart> {
        let sessionCart = await this.sessionCartRepository.findOne({ where: { sessionId } });
        if (!sessionCart) {
            sessionCart = this.sessionCartRepository.create({ sessionId });
            await this.sessionCartRepository.save(sessionCart);
        }
        return sessionCart;
    }

    async addToSessionCart(sessionId: string, productId: number, quantity: number): Promise<{
        cart: SessionCart,
        quantityChanges: QuantityChange[]
    }> {
        this.commonValidationService.validateQuantity(quantity);

        return this.dataSource.transaction(async (transactionalEntityManager) => {
            const sessionCart = await this.getOrCreateSessionCart(sessionId);
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
        const sessionCart = await this.getOrCreateSessionCart(sessionId);
        await this.cartItemRepository.delete({
            sessionCart: { id: sessionCart.id },
            product: { id: productId },
        });
        await this.updateSessionCartTotals(sessionCart.id);
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

    async getSessionCart(sessionId: string): Promise<SessionCart | null> {
        return this.sessionCartRepository.findOne({
            where: { sessionId },
            relations: ['cartItems', 'cartItems.product'],
        });
    }
}