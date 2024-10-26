import { Module } from "@nestjs/common";
import { OrderService } from "./services/order.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { User } from "src/entities/User.entity";
import { Product } from "src/entities/Product.entity";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { OrderController } from "./order.controller";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { OrderValidationService } from "./services/order-validation.service";
import { CartModule } from "src/carts/cart.module";
import { CartUtilityService } from "src/carts/services/cart-utility.service";
import { BuyNowCartService } from "src/carts/services/buy-now-cart.service";
import { SessionCartService } from "src/carts/services/session-cart.service";
import { CartService } from "src/carts/services/cart.service";
import { SessionCart } from "src/entities/SessionCart.entity";
import { BuyNowSessionCart } from "src/entities/BuyNowSessionCart.entity";
import { CartItemService } from "src/carts/services/cart-item.service";
import { OrderUtilityService } from "./services/order-utility.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User, Product, Cart, CartItem, SessionCart, BuyNowSessionCart]),
    CartModule
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    CommonValidationService,
    OrderValidationService,
    CartUtilityService,
    OrderUtilityService,
    BuyNowCartService,
    SessionCartService,
    CartService,
    CartItemService
  ],
})
export class OrderModule { }
