import { Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import { FormattedCartItem } from "src/carts/types/formatted-cart-item.type";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.entity";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { RedisService } from "src/redis/redis.service";
import { EntityManager, In } from "typeorm";
import { ValidatedOrderItem } from "../types/validated-order-item.type";
import { OrderValidationService } from "./order-validation.service";

@Injectable()
export class OrderUtilityService {
  // Threshold to determine when a product is considered low in stock
  private readonly LOW_STOCK_THRESHOLD = 5;

  constructor(
    private readonly orderValidationService: OrderValidationService,
    private readonly redisService: RedisService,
  ) {}

  // Transforms an OrderItem entity into a simplified DTO format for client consumption
  transformOrderItem(orderItem: OrderItem) {
    return {
      id: orderItem.product.id,
      quantity: orderItem.quantity,
      price: new Decimal(orderItem.quantity).times(orderItem.product.price).toFixed(2),
      productName: orderItem.product.productName,
      brand: orderItem.product.brand,
      thumbnail: orderItem.product.thumbnail,
      category: orderItem.product.subcategory.category.category,
      subcategory: orderItem.product.subcategory.subcategory,
    };
  }

  // Transforms a complete Order entity into a simplified format for order history display
  transformOrder(order: Order) {
    const orderQuantity = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);

    // Transform order items into a minimal format needed for order history
    const transformedOrderItems = order.orderItems.map(item => ({
      productId: item.product.id,
      productName: item.product.productName,
      thumbnail: item.product.thumbnail,
      subcategory: item.product.subcategory.subcategory,
      category: item.product.subcategory.category.category,
    }));

    return {
      orderId: order.id,
      orderTotal: order.orderTotal,
      orderDate: order.orderDate,
      orderQuantity,
      user: {
        firstName: order.user.firstName,
        lastName: order.user.lastName,
      },
      orderItems: transformedOrderItems,
    };
  }

  // Handles cache invalidation for products that are running low on stock
  async handleLowStockProducts(products: Product[]) {
    // Filter products that have fallen below the low stock threshold
    const lowStockProducts = products.filter(product => product.stock <= this.LOW_STOCK_THRESHOLD);

    if (lowStockProducts.length > 0) {
      // Invalidate cache for low stock products to ensure accurate stock display
      await Promise.all(
        lowStockProducts.map(product => this.redisService.invalidateProductCache(product.id)),
      );
    }
  }

  // Creates a new order and its associated order items within a transaction
  async createOrderWithItems(
    user: User,
    idempotencyKey: string,
    cartItems: FormattedCartItem[],
    transactionManager: EntityManager,
  ) {
    const order = new Order();
    order.user = user;
    // Idempotency key prevents duplicate orders from being processed
    order.idempotencyKey = idempotencyKey;

    const validatedOrderItems = await this.orderValidationService.validateOrderItems(
      cartItems,
      transactionManager,
    );

    order.orderTotal = validatedOrderItems.reduce(
      (total, { orderItemTotal }) => new Decimal(total).plus(orderItemTotal).toFixed(2),
      "0.00",
    );
    const savedOrder = await transactionManager.save(Order, order);

    // Prepare order items and update product quantities
    const { orderItemsEntities, updatedProducts } = this.prepareOrderItemsAndProducts(
      validatedOrderItems,
      savedOrder,
    );

    await transactionManager.save(Product, updatedProducts);

    return { savedOrder, updatedProducts, orderItemsEntities };
  }

  // Prepares order items and updates product quantities for a new order
  prepareOrderItemsAndProducts(validatedOrderItems: ValidatedOrderItem[], savedOrder: Order) {
    const orderItemsEntities = validatedOrderItems.map(
      ({ validatedOrderItem, product, orderItemTotal }) => {
        const orderItem = new OrderItem();
        orderItem.order = savedOrder;
        orderItem.quantity = validatedOrderItem.quantity;
        orderItem.product = product;
        orderItem.productPrice = new Decimal(orderItemTotal)
          .div(validatedOrderItem.quantity)
          .toFixed(2);
        orderItem.totalPrice = orderItemTotal;

        // Update product stock and sold count
        product.stock -= validatedOrderItem.quantity;
        product.sold += validatedOrderItem.quantity;

        return orderItem;
      },
    );

    // Extract updated products for bulk saving
    const updatedProducts = validatedOrderItems.map(({ product }) => product);

    return { orderItemsEntities, updatedProducts };
  }

  // Cleans up cart items after successful order placement
  async handleNormalCartCleanup(
    cart: Cart,
    cartItems: FormattedCartItem[],
    transactionManager: EntityManager,
  ) {
    // Find all current cart items that match the ordered products
    const currentCartItems = await transactionManager.find(CartItem, {
      where: {
        cart: { id: cart.id },
        product: {
          id: In(cartItems.map(product => product.id)),
        },
      },
      relations: ["product"],
    });

    // Determine which items to remove or update based on ordered quantities
    const { itemsToRemove, itemsToUpdate } = this.categorizeCartItems(currentCartItems, cartItems);

    // Remove items that were completely purchased
    if (itemsToRemove.length > 0) {
      await transactionManager.remove(CartItem, itemsToRemove);
    }

    // Update quantities for partially purchased items
    if (itemsToUpdate.length > 0) {
      for (const item of itemsToUpdate) {
        // Update the cart item's amount based on new quantity
        item.amount = new Decimal(item.quantity).mul(item.product.price).toFixed(2);
      }
      await transactionManager.save(CartItem, itemsToUpdate);
    }

    // Fetch all remaining cart items to recalculate totals
    const remainingCartItems = await transactionManager.find(CartItem, {
      where: { cart: { id: cart.id } },
      relations: ["product"],
    });

    // Recalculate cart totals from scratch
    let totalQuantity = 0;
    let cartTotal = new Decimal(0);

    for (const cartItem of remainingCartItems) {
      totalQuantity += cartItem.quantity;
      cartTotal = cartTotal.plus(cartItem.amount);
    }

    // Update cart with new totals
    cart.totalQuantity = totalQuantity;
    cart.cartTotal = cartTotal.toFixed(2);

    await transactionManager.save(cart);
  }

  // Categorizes cart items for cleanup after order placement
  categorizeCartItems(currentCartItems: CartItem[], snapshotCartItems: FormattedCartItem[]) {
    const itemsToRemove: CartItem[] = [];
    const itemsToUpdate: CartItem[] = [];

    for (const currentItem of currentCartItems) {
      const orderedItem = snapshotCartItems.find(item => item.id === currentItem.product.id);
      if (orderedItem) {
        // If ordered quantity >= cart quantity, remove item completely
        if (currentItem.quantity <= orderedItem.quantity) {
          itemsToRemove.push(currentItem);
        } else {
          // If ordered quantity < cart quantity, reduce cart quantity
          currentItem.quantity -= orderedItem.quantity;
          itemsToUpdate.push(currentItem);
        }
      }
    }

    return { itemsToRemove, itemsToUpdate };
  }
}
