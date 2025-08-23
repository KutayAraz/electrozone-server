import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CartModule } from "src/carts/cart.module";
import { BuyNowCartService } from "src/carts/services/buy-now-cart.service";
import { CartItemService } from "src/carts/services/cart-item.service";
import { CartUtilityService } from "src/carts/services/cart-utility.service";
import { CartService } from "src/carts/services/cart.service";
import { SessionCartService } from "src/carts/services/session-cart.service";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { BuyNowSessionCart } from "src/entities/BuyNowSessionCart.entity";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.entity";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { SessionCart } from "src/entities/SessionCart.entity";
import { User } from "src/entities/User.entity";
import { ReviewService } from "src/products/services/review.service";
import { OrderController } from "./order.controller";
import { OrderUtilityService } from "./services/order-utility.service";
import { OrderValidationService } from "./services/order-validation.service";
import { OrderService } from "./services/order.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      User,
      Product,
      Cart,
      CartItem,
      SessionCart,
      BuyNowSessionCart,
      Review,
    ]),
    CartModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    CommonValidationService,
    OrderValidationService,
    CartUtilityService,
    BuyNowCartService,
    SessionCartService,
    CartService,
    CartItemService,
    OrderUtilityService,
    ReviewService,
  ],
})
export class OrderModule {}
