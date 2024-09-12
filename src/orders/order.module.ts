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

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User, Product, Cart, CartItem]),
    CartModule
  ],
  controllers: [OrderController],
  providers: [OrderService, CommonValidationService, OrderValidationService],
})
export class OrderModule { }
