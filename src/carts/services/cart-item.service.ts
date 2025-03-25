import { Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import { ErrorType } from "src/common/errors/error-type";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { SessionCart } from "src/entities/SessionCart.entity";
import { EntityManager } from "typeorm";
import { CartIdentifier } from "../types/cart-identifier.type";
import { FormattedCartItem } from "../types/formatted-cart-item.type";
import { PriceChange } from "../types/price-change.type";
import { QuantityChange } from "../types/quantity-change.type";
import { CartUtilityService } from "./cart-utility.service";

@Injectable()
export class CartItemService {
  constructor(
    private readonly cartUtilityService: CartUtilityService,
    private readonly commonValidationService: CommonValidationService,
  ) {}

  async addCartItem(
    cart: Cart | SessionCart,
    product: Product,
    quantity: number,
    transactionManager: EntityManager,
  ): Promise<QuantityChange> {
    // Validate that product exists and is in stock
    this.commonValidationService.validateProduct(product);
    this.commonValidationService.validateStock(product);

    // Ensure the cart is saved to the database
    await transactionManager.save(cart);

    let cartItem = await transactionManager.findOne(CartItem, {
      where: [
        { cart: { id: cart.id }, product: { id: product.id } },
        { sessionCart: { id: cart.id }, product: { id: product.id } },
      ],
      relations: ["product"],
    });

    // Check if the product is already in the cart
    const currentQuantity = cartItem ? cartItem.quantity : 0;

    // Make sure that quantity does not exceed 10
    let newQuantity = Math.min(currentQuantity + quantity, 10, product.stock);
    let quantityChange: QuantityChange;

    // If quantity changed because it went over the limit, add it to quantityChanges array
    if (newQuantity !== currentQuantity + quantity) {
      quantityChange = {
        productName: product.productName,
        oldQuantity: currentQuantity + quantity,
        newQuantity,
        reason:
          newQuantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED,
      };
    }

    const quantityToAdd = newQuantity - currentQuantity;

    // If it was already in cart, update the existing cartItem
    if (cartItem) {
      cartItem.quantity = newQuantity;
      cartItem.amount = new Decimal(newQuantity).mul(new Decimal(product.price)).toFixed(2);
      cartItem.addedPrice = product.price;
    } else {
      // Create a new CartItem
      cartItem = transactionManager.create(CartItem, {
        product,
        quantity: newQuantity,
        amount: new Decimal(newQuantity).mul(new Decimal(product.price)).toFixed(2),
        addedPrice: product.price,
      });

      // Set the correct relation based on the cart type
      if (cart instanceof SessionCart) {
        cartItem.sessionCart = cart;
      } else {
        cartItem.cart = cart;
      }
    }

    cart.totalQuantity += quantityToAdd;
    cart.cartTotal = new Decimal(cart.cartTotal)
      .plus(new Decimal(quantityToAdd).mul(new Decimal(product.price)))
      .toFixed(2);

    // Save both the cartItem and the cart
    await transactionManager.save(cartItem);
    await transactionManager.save(cart);

    return quantityChange;
  }

  async removeCartItem(
    cart: Cart | SessionCart,
    cartItem: CartItem,
    transactionManager: EntityManager,
  ): Promise<Cart | SessionCart> {
    this.commonValidationService.validateProduct(cartItem.product);

    cart.totalQuantity -= cartItem.quantity;
    cart.cartTotal = new Decimal(cart.cartTotal).mul(cartItem.amount).toFixed(2);

    await transactionManager.save(cart);
    await transactionManager.remove(cartItem);

    return cart;
  }

  async updateCartItemQuantity(
    cart: Cart | SessionCart,
    cartItem: CartItem,
    quantity: number,
    transactionManager: EntityManager,
  ): Promise<CartItem> {
    // Make sure the requested quantity is available in stock
    this.commonValidationService.validateStockAvailability(cartItem.product, quantity);

    const oldQuantity = cartItem.quantity;
    const oldAmount = new Decimal(oldQuantity).mul(cartItem.product.price).toFixed(2);
    const newAmount = new Decimal(quantity).mul(cartItem.product.price).toFixed(2);

    cartItem.quantity = quantity;
    cartItem.amount = newAmount;

    // Update the cart
    cart.totalQuantity += quantity - oldQuantity;
    cart.cartTotal = new Decimal(cart.cartTotal).plus(newAmount).minus(oldAmount).toFixed(2);

    await transactionManager.save(cartItem);
    await transactionManager.save(cart);

    return cartItem;
  }

  async fetchAndUpdateCartItems(
    transactionManager: EntityManager,
    cartIdentifier: CartIdentifier,
  ): Promise<{
    cartItems: FormattedCartItem[];
    removedCartItems: string[];
    priceChanges: PriceChange[];
    quantityChanges: QuantityChange[];
  }> {
    let cartItems: CartItem[];

    // Check if the function is called for user cart or a session cart
    if ("cartId" in cartIdentifier) {
      cartItems = await this.cartUtilityService.getCartItems(
        cartIdentifier.cartId,
        false,
        transactionManager,
      );
    } else if ("sessionCartId" in cartIdentifier) {
      cartItems = await this.cartUtilityService.getCartItems(
        cartIdentifier.sessionCartId,
        true,
        transactionManager,
      );
    } else {
      throw new Error("Invalid cart identifier provided");
    }

    // Initialize arrays to store the results
    const formattedCartItems: FormattedCartItem[] = [];
    const removedCartItems: string[] = [];
    const priceChanges: PriceChange[] = [];
    const quantityChanges: QuantityChange[] = [];

    // Process each cart item concurrently
    await Promise.all(
      cartItems.map(async cartItem => {
        if (cartItem.product.stock > 0) {
          // Update the cart item if the product is in stock
          const { updatedCartItem, quantityChange, priceChange } = await this.updateCartItem(
            cartItem,
            transactionManager,
          );

          // Add the updated cart item to the formatted items list
          formattedCartItems.push(this.cartUtilityService.formatCartItem(updatedCartItem));

          // Record any quantity or price changes
          if (quantityChange) quantityChanges.push(quantityChange);
          if (priceChange) priceChanges.push(priceChange);
        } else {
          // Remove the cart item if the product is out of stock
          await transactionManager.delete(CartItem, cartItem.id);
          removedCartItems.push(cartItem.product.productName);
        }
      }),
    );

    return {
      cartItems: formattedCartItems,
      removedCartItems,
      priceChanges,
      quantityChanges,
    };
  }

  async updateCartItem(
    cartItem: CartItem,
    transactionManager: EntityManager,
  ): Promise<{
    updatedCartItem: CartItem;
    quantityChange: QuantityChange | null;
    priceChange: PriceChange | null;
  }> {
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
        reason:
          quantity === 10 ? ErrorType.QUANTITY_LIMIT_EXCEEDED : ErrorType.STOCK_LIMIT_EXCEEDED,
      };
      await transactionManager.update(CartItem, cartItem.id, {
        quantity,
        amount: new Decimal(currentPrice).mul(quantity).toFixed(2),
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
        amount: new Decimal(currentPrice).mul(quantity).toFixed(2),
      });
    }

    // Return final version of the cart item and changes
    return {
      updatedCartItem: { ...cartItem, quantity, addedPrice: currentPrice },
      quantityChange,
      priceChange,
    };
  }
}
