import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { Repository, In, DataSource } from "typeorm";
import { CartItemDto } from "../dtos/cart-item.dto";
import { LocalCartResponse } from "../types/local-cart-response.type";
import { CartService } from "./carts.service";
import { CartHelperService } from "./cart-helper.service";
import { CartOperationsService } from "./cart-operations.service";
import { CartValidationService } from "./cart-validation.service";
import { QuantityChange } from "../types/quantity-change.type";

@Injectable()
export class LocalCartService {
    constructor(
        @InjectRepository(Product) private productsRepo: Repository<Product>,
        private readonly cartOperationsService: CartOperationsService,
        private readonly cartHelperService: CartHelperService,
        private readonly cartValidationService: CartValidationService,
        private readonly cartsService: CartService,
        private readonly dataSource: DataSource
    ) { }

    async getLocalCartInformation(products: CartItemDto[]): Promise<LocalCartResponse> {
        if (!Array.isArray(products)) {
            throw new AppError(ErrorType.INVALID_INPUT, undefined, "Expected an array of products");
        }

        const productIds = products.map(product => product.productId);
        const foundProducts = await this.productsRepo.find({
            where: { id: In(productIds) },
            select: ['id', 'productName', 'thumbnail', 'price', 'brand', 'stock'],
            relations: ["subcategory", "subcategory.category"],
        });

        const productMap = new Map(foundProducts.map(product => [product.id, product]));
        const localCartProducts = [];
        const removedItems: string[] = [];
        const quantityAdjustments: QuantityChange[] = [];
        let cartTotal = 0;
        let totalQuantity = 0;

        for (const product of products) {
            const foundProduct = productMap.get(product.productId);
            if (!foundProduct) continue;

            if (foundProduct.stock <= 0) {
                removedItems.push(foundProduct.productName);
                continue;
            }

            let quantity = Math.min(product.quantity, foundProduct.stock, 10);

            if (quantity !== product.quantity) {
                quantityAdjustments.push({
                    productName: foundProduct.productName,
                    oldQuantity: product.quantity,
                    newQuantity: quantity,
                    reason: quantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
                });
            }

            const amount = Number((foundProduct.price * quantity).toFixed(2));
            cartTotal += amount;
            totalQuantity += quantity;

            localCartProducts.push({
                id: product.productId,
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

        return { cartTotal, totalQuantity, products: localCartProducts, removedItems, quantityAdjustments };
    }

    async getBuyNowCartInfo(productId: number, quantity: number) {
        this.cartValidationService.validateQuantity(quantity)

        const foundProduct = await this.productsRepo.findOne({
            where: { id: productId },
            relations: ["subcategory", "subcategory.category"],
        });

        this.cartValidationService.validateProduct(foundProduct)
        this.cartValidationService.validateStockAvailability(foundProduct, quantity)

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

    async mergeLocalWithBackendCart(userId: number, localCartItems: CartItemDto[]) {
        return this.dataSource.transaction(async transactionalEntityManager => {
            const cart = await this.cartHelperService.findOrCreateCart(userId, transactionalEntityManager);

            const existingItemsMap = new Map<number, CartItem>();
            cart.cartItems.forEach((item) => {
                existingItemsMap.set(item.product.id, item);
            });

            for (const localItem of localCartItems) {
                const existingProduct = existingItemsMap.get(localItem.productId);

                if (existingProduct) {
                    const newQuantity = localItem.quantity + existingProduct.quantity;
                    await this.cartOperationsService.updateCartItemQuantity(
                        userId,
                        localItem.productId,
                        newQuantity,
                        transactionalEntityManager
                    );
                } else {
                    await this.cartOperationsService.addProductToCart(
                        userId,
                        localItem.productId,
                        localItem.quantity,
                        transactionalEntityManager
                    );
                }
            }

            return await this.cartsService.getUserCart(userId, transactionalEntityManager);
        });
    }
}