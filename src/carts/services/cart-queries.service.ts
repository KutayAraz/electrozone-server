import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { Repository, DataSource, EntityManager, In } from "typeorm";
import { CartItemDto } from "../dtos/cart-item.dto";
import CartResponse from "../types/cart-response.type";
import { LocalCartResponse } from "../types/local-cart-response.type";
import QuantityChange from "../types/quantity-change.type";
import { CartOperationsService } from "./cart-operations.service";

@Injectable()
export class CartQueriesService {
    constructor(
        @InjectRepository(Product) private productsRepo: Repository<Product>,
        private readonly cartOperationsService: CartOperationsService,
        private dataSource: DataSource,
    ) { }

    async getUserCart(userId: number, transactionalEntityManager?: EntityManager): Promise<CartResponse> {
        const manager = transactionalEntityManager || this.dataSource.manager;

        return manager.transaction(async (transactionManager) => {

            let cart = await this.cartOperationsService.findOrCreateCart(userId, transactionManager);

            const { products, removedItems, priceChanges, quantityChanges } = await this.cartOperationsService.fetchAndUpdateCartProducts(cart.id, transactionManager);

            // Recalculate cart total and quantity
            const cartTotal = products.reduce((total, product) => total + product.amount, 0);
            const totalQuantity = products.reduce((total, product) => total + product.quantity, 0);

            // Update cart in database
            await transactionManager.update(Cart, cart.id, { cartTotal, totalQuantity });

            return {
                cartTotal,
                totalQuantity,
                products,
                removedItems,
                priceChanges,
                quantityChanges,
            };
        });
    }

    async getCartItemsWithProducts(cartId: number, transactionManager: EntityManager) {
        return transactionManager
            .createQueryBuilder(CartItem, "cartItem")
            .select([
                "cartItem.id", "cartItem.quantity", "cartItem.amount", "cartItem.addedPrice",
                "product.productName", "product.averageRating", "product.thumbnail",
                "product.price", "product.id", "product.stock",
                "subcategory.subcategory", "category.category",
            ])
            .innerJoin("cartItem.product", "product")
            .innerJoin("product.subcategory", "subcategory")
            .innerJoin("subcategory.category", "category")
            .where("cartItem.cartId = :cartId", { cartId })
            .getMany();
    }

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
        if (quantity > 10) {
            throw new AppError(ErrorType.QUANTITY_LIMIT_EXCEEDED);
        }

        const foundProduct = await this.productsRepo.findOne({
            where: { id: productId },
            relations: ["subcategory", "subcategory.category"],
        });

        if (!foundProduct) {
            throw new AppError(ErrorType.PRODUCT_NOT_FOUND, productId, foundProduct.productName);
        }

        if (foundProduct.stock < quantity) {
            throw new AppError(ErrorType.STOCK_LIMIT_EXCEEDED, productId, foundProduct.productName);
        }

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
}