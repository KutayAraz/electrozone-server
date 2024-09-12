import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { Repository, In, DataSource } from "typeorm";
import { CartItemDto } from "../dtos/cart-item.dto";
import { LocalCartResponse } from "../types/local-cart-response.type";
import { CartService } from "./cart.service";
import { CartOperationsService } from "./cart-operations.service";
import { QuantityChange } from "../types/quantity-change.type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { CartUtilityService } from "./cart-utility.service";

@Injectable()
export class LocalCartService {
    constructor(
        @InjectRepository(Product) private productsRepo: Repository<Product>,
        private readonly cartOperationsService: CartOperationsService,
        private readonly cartUtilityService: CartUtilityService,
        private readonly commonValidationService: CommonValidationService,
        private readonly cartsService: CartService,
        private readonly dataSource: DataSource
    ) { }

    async getLocalCartInformation(cartItems: CartItemDto[]): Promise<LocalCartResponse> {
        if (!Array.isArray(cartItems)) {
            throw new AppError(ErrorType.INVALID_INPUT, "undefined, Expected an array of products");
        }

        const productIds = cartItems.map(cartItem => cartItem.productId);
        const foundProducts = await this.productsRepo.find({
            where: { id: In(productIds) },
            select: ['id', 'productName', 'thumbnail', 'price', 'brand', 'stock'],
            relations: ["subcategory", "subcategory.category"],
        });

        const productMap = new Map(foundProducts.map(product => [product.id, product]));
        const localCartItems = [];
        const removedCartItems: string[] = [];
        const quantityAdjustments: QuantityChange[] = [];
        let cartTotal = 0;
        let totalQuantity = 0;

        for (const cartItem of cartItems) {
            const foundProduct = productMap.get(cartItem.productId);
            if (!foundProduct) continue;

            if (foundProduct.stock <= 0) {
                removedCartItems.push(foundProduct.productName);
                continue;
            }

            let quantity = Math.min(cartItem.quantity, foundProduct.stock, 10);

            if (quantity !== cartItem.quantity) {
                quantityAdjustments.push({
                    productName: foundProduct.productName,
                    oldQuantity: cartItem.quantity,
                    newQuantity: quantity,
                    reason: quantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
                });
            }

            const amount = Number((foundProduct.price * quantity).toFixed(2));
            cartTotal += amount;
            totalQuantity += quantity;

            localCartItems.push({
                id: cartItem.productId,
                quantity,
                amount,
                productName: foundProduct.productName,
                thumbnail: foundProduct.thumbnail,
                price: foundProduct.price,
                brand: foundProduct.brand,
                subcategory: foundProduct.subcategory.subcategory,
                category: foundProduct.subcategory.category.category,
                stock: foundProduct.stock,
            });
        }

        return { cartTotal, totalQuantity, products: localCartItems, removedCartItems, quantityAdjustments };
    }

    async getBuyNowCartInfo(productId: number, quantity: number) {
        this.commonValidationService.validateQuantity(quantity)

        const foundProduct = await this.productsRepo.findOne({
            where: { id: productId },
            relations: ["subcategory", "subcategory.category"],
        });

        this.commonValidationService.validateProduct(foundProduct)
        this.commonValidationService.validateStockAvailability(foundProduct, quantity)

        const amount = Number((foundProduct.price * quantity).toFixed(2));
        const cartTotal = amount;
        const totalQuantity = quantity;

        const product = {
            id: foundProduct.id,
            quantity: totalQuantity,
            amount,
            productName: foundProduct.productName,
            thumbnail: foundProduct.thumbnail,
            price: foundProduct.price,
            brand: foundProduct.brand,
            subcategory: foundProduct.subcategory.subcategory,
            category: foundProduct.subcategory.category.category,
            availableStock: foundProduct.stock,
        };

        return { cartTotal, totalQuantity, products: [product] };
    }

    async mergeLocalWithBackendCart(userUuid: string, localCartItems: CartItemDto[]) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const cart = await this.cartUtilityService.findOrCreateCart(userUuid, transactionalEntityManager);

            const existingItemsMap = new Map<number, CartItem>();
            cart.cartItems.forEach((item) => {
                existingItemsMap.set(item.product.id, item);
            });

            for (const localItem of localCartItems) {
                const existingProduct = existingItemsMap.get(localItem.productId);

                if (existingProduct) {
                    const newQuantity = localItem.quantity + existingProduct.quantity;
                    await this.cartOperationsService.updateCartItemQuantity(
                        userUuid,
                        localItem.productId,
                        newQuantity,
                        transactionalEntityManager
                    );
                } else {
                    await this.cartOperationsService.addProductToCart(
                        userUuid,
                        localItem.productId,
                        localItem.quantity,
                        transactionalEntityManager
                    );
                }
            }

            return await this.cartsService.getUserCart(userUuid, transactionalEntityManager);
        });
    }
}