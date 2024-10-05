import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { PriceChange } from "../types/price-change.type";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { QuantityChange } from "../types/quantity-change.type";
import { FormattedCartItem } from "../types/formatted-cart-product.type";
import { CartUtilityService } from "./cart-utility.service";
import { CartIdentifier } from "../types/cart-identifier.type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { Cart } from "src/entities/Cart.entity";
import { Product } from "src/entities/Product.entity";
import { SessionCart } from "src/entities/SessionCart.entity";

@Injectable()
export class CartItemService {
    constructor(
        private readonly cartUtilityService: CartUtilityService,
        private readonly commonValidationService: CommonValidationService
    ) { }

    async addCartItem(
        cart: Cart | SessionCart,
        product: Product,
        quantity: number,
        transactionManager: EntityManager
    ) {
        // Validate that product exists and is in stock
        this.commonValidationService.validateProduct(product);
        this.commonValidationService.validateStock(product);

        let cartItem = await transactionManager.findOne(CartItem, {
            where: {
                cart: { id: cart.id },
                product: { id: product.id }
            },
            relations: ["product"],
        });

        // Check if the product is already in the cart
        const currentQuantity = cartItem ? cartItem.quantity : 0;

        // Make sure that quantity does not exceed 10
        let newQuantity = Math.min(currentQuantity + quantity, 10, product.stock);
        const quantityChanges: QuantityChange[] = [];

        // If quantity changed because it went over the limit, add it to quantityChanges array
        if (newQuantity !== currentQuantity + quantity) {
            quantityChanges.push({
                productName: product.productName,
                oldQuantity: currentQuantity + quantity,
                newQuantity,
                reason: newQuantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
            });
        }

        const quantityToAdd = newQuantity - currentQuantity;

        // If it was already in cart, increase the quantity 
        // If not create a new CartItem
        if (cartItem) {
            cartItem.quantity = newQuantity;
            cartItem.amount = newQuantity * product.price;
            cartItem.addedPrice = product.price;
        } else {
            cartItem = transactionManager.create(CartItem, {
                product,
                quantity: newQuantity,
                amount: newQuantity * product.price,
                cart,
                addedPrice: product.price
            });
        }

        cart.totalQuantity += quantityToAdd;
        cart.cartTotal = Number(cart.cartTotal) + Number(quantityToAdd * product.price);

        await transactionManager.save(cartItem);
        await transactionManager.save(cart);

        return { quantityChanges };
    }

    async removeCartItem(
        cart: Cart | SessionCart,
        cartItem: CartItem,
        transactionManager: EntityManager
    ) {
        this.commonValidationService.validateProduct(cartItem.product);

        cart.totalQuantity -= cartItem.quantity;
        cart.cartTotal = Number(cart.cartTotal) - Number(cartItem.amount);

        await transactionManager.save(cart);
        await transactionManager.remove(cartItem);

        return cart;
    }

    async updateCartItemQuantity(
        cart: Cart | SessionCart,
        cartItem: CartItem,
        quantity: number,
        transactionManager: EntityManager
    ) {
        // Make sure the requested quantity is available in stock
        this.commonValidationService.validateStockAvailability(cartItem.product, quantity);

        const oldQuantity = cartItem.quantity;
        const oldAmount = oldQuantity * cartItem.product.price;
        const newAmount = quantity * cartItem.product.price;

        cartItem.quantity = quantity;
        cartItem.amount = newAmount;

        // Update the cart
        cart.totalQuantity += quantity - oldQuantity;
        cart.cartTotal = Number(cart.cartTotal) + Number(newAmount) - Number(oldAmount);

        await transactionManager.save(cartItem);
        await transactionManager.save(cart);

        return cartItem;
    }

    async fetchAndUpdateCartItems(transactionManager: EntityManager, cartIdentifier: CartIdentifier): Promise<{
        cartItems: FormattedCartItem[],
        removedCartItems: string[],
        priceChanges: PriceChange[],
        quantityChanges: QuantityChange[]
    }> {
        let cartItems: CartItem[];

        // Check if the function is called for user cart or a session cart
        if ('cartId' in cartIdentifier) {
            cartItems = await this.cartUtilityService.getCartItems(cartIdentifier.cartId, false, transactionManager);
        } else if ('sessionCartId' in cartIdentifier) {
            cartItems = await this.cartUtilityService.getCartItems(cartIdentifier.sessionCartId, true, transactionManager);
        } else {
            throw new Error('Invalid cart identifier provided');
        }

        // Create arrays for final cartItems and changes
        const formattedCartItems: FormattedCartItem[] = [];
        const removedCartItems: string[] = [];
        const priceChanges: PriceChange[] = [];
        const quantityChanges: QuantityChange[] = [];

        await Promise.all(cartItems.map(async (cartItem) => {
            if (cartItem.product.stock > 0) {
                const { updatedCartItem, quantityChange, priceChange } =
                    await this.updateCartItem(cartItem, transactionManager);

                formattedCartItems.push(this.cartUtilityService.formatCartItem(updatedCartItem));
                if (quantityChange) quantityChanges.push(quantityChange);
                if (priceChange) priceChanges.push(priceChange);
            } else {
                await transactionManager.delete(CartItem, cartItem.id);
                removedCartItems.push(cartItem.product.productName);
            }
        }));

        return { cartItems: formattedCartItems, removedCartItems, priceChanges, quantityChanges };
    }

    async updateCartItem(cartItem: CartItem, transactionManager: EntityManager) {
        const currentPrice = cartItem.product.price;
        const addedPrice = cartItem.addedPrice;
        let quantity = cartItem.quantity;
        let quantityChange: QuantityChange | null = null;
        let priceChange: PriceChange | null = null;

        // Check if the quantity is over what is available in stock or over 10
        if (quantity > cartItem.product.stock || quantity > 10) {
            const oldQuantity = quantity;
            quantity = Math.min(cartItem.product.stock, 10);
            quantityChange = {
                productName: cartItem.product.productName,
                oldQuantity,
                newQuantity: quantity,
                // Add the reason for quantity change to the object
                reason: quantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED
            };
            await transactionManager.update(CartItem, cartItem.id, {
                quantity,
                amount: currentPrice * quantity
            });
        }

        // Check if the product price has changed by comparing the added price and current price
        if (addedPrice !== null && addedPrice !== undefined && currentPrice !== addedPrice) {
            priceChange = {
                productName: cartItem.product.productName,
                oldPrice: addedPrice,
                newPrice: currentPrice,
            };
            await transactionManager.update(CartItem, cartItem.id, {
                addedPrice: currentPrice,
                amount: currentPrice * quantity
            });
        }

        // Return final version of the cart item and changes
        return { updatedCartItem: { ...cartItem, quantity, addedPrice: currentPrice }, quantityChange, priceChange };
    }
}