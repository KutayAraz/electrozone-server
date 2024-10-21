import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { BuyNowSessionCart } from "src/entities/BuyNowSessionCart.entity";
import { DataSource, EntityManager, Repository } from "typeorm";
import { Product } from "src/entities/Product.entity";
import { ErrorType } from "src/common/errors/error-type";
import { CartItem } from "src/entities/CartItem.entity";
import { PriceChange } from "../types/price-change.type";
import { QuantityChange } from "../types/quantity-change.type";
import { CartUtilityService } from "./cart-utility.service";
import { CartResponse } from "../types/cart-response.type";
import Decimal from "decimal.js";

@Injectable()
export class BuyNowCartService {
  constructor(
    @InjectRepository(BuyNowSessionCart)
    private buyNowCartRepository: Repository<BuyNowSessionCart>,
    @InjectRepository(Product) private productRepository: Repository<Product>,
    private readonly commonValidationService: CommonValidationService,
    private readonly cartUtilityService: CartUtilityService,
    private readonly dataSource: DataSource,
  ) {}

  async createBuyNowCart(
    sessionId: string,
    productId: number,
    quantity: number,
  ): Promise<void> {
    this.commonValidationService.validateSessionId(sessionId);
    this.commonValidationService.validateQuantity(quantity);

    return this.dataSource.transaction(async (transactionManager) => {
      // Clear any existing buy-now cart for this session
      await this.clearBuyNowCart(sessionId, transactionManager);

      // Get product with current price and stock
      const product = await this.productRepository.findOne({
        where: { id: productId },
      });

      this.commonValidationService.validateProduct(product);

      this.commonValidationService.validateStockAvailability(product, quantity);

      // Create new buy-now cart
      const buyNowCart = new BuyNowSessionCart();
      buyNowCart.sessionId = sessionId;
      buyNowCart.product = product;
      buyNowCart.quantity = quantity;
      buyNowCart.addedPrice = product.price;
      buyNowCart.total = new Decimal(product.price).times(quantity).toFixed(2);

      await transactionManager.save(buyNowCart);
    });
  }

  async getBuyNowCart(sessionId: string): Promise<CartResponse | null> {
    this.commonValidationService.validateSessionId(sessionId);

    const buyNowCart = await this.buyNowCartRepository.findOne({
      where: { sessionId },
      relations: ["product"],
    });

    if (!buyNowCart) {
      return null;
    }

    const product = await this.productRepository.findOne({
      where: { id: buyNowCart.product.id },
    });

    // Verify if product still exists and is in stock
    this.commonValidationService.validateProduct(product);
    this.commonValidationService.validateStock(product);

    const quantityChanges: QuantityChange[] = [];
    const priceChanges: PriceChange[] = [];

    // Check for stock availability
    if (buyNowCart.quantity > product.stock) {
      quantityChanges.push({
        productName: product.productName,
        oldQuantity: buyNowCart.quantity,
        newQuantity: product.stock,
        reason: ErrorType.STOCK_LIMIT_EXCEEDED,
      });
      buyNowCart.quantity = product.stock;
      await this.buyNowCartRepository.save(buyNowCart);
    }

    // Check for price changes
    if (product.price !== buyNowCart.addedPrice) {
      priceChanges.push({
        productName: product.productName,
        oldPrice: buyNowCart.addedPrice,
        newPrice: product.price,
      });
      buyNowCart.addedPrice = product.price;
      buyNowCart.total = new Decimal(product.price)
        .times(buyNowCart.quantity)
        .toFixed(2);
      await this.buyNowCartRepository.save(buyNowCart);
    }

    // Create a temporary CartItem object to use with formatCartItem
    const tempCartItem = new CartItem();
    tempCartItem.id = buyNowCart.id;
    tempCartItem.quantity = buyNowCart.quantity;
    tempCartItem.product = product;

    const formattedCartItem =
      this.cartUtilityService.formatCartItem(tempCartItem);

    return {
      cartItems: [formattedCartItem],
      totalQuantity: buyNowCart.quantity,
      cartTotal: buyNowCart.total,
      priceChanges,
      quantityChanges,
    };
  }

  async clearBuyNowCart(
    sessionId: string,
    transactionManager?: EntityManager,
  ): Promise<void> {
    this.commonValidationService.validateSessionId(sessionId);

    const manager = transactionManager || this.dataSource.manager;
    await manager.delete(BuyNowSessionCart, { sessionId });
  }
}
