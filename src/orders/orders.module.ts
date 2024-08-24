import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { User } from "src/entities/User.entity";
import { Product } from "src/entities/Product.entity";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { CartOperationsService } from "src/carts/services/cart-operations.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User, Product, Cart, CartItem]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, CartOperationsService],
})
export class OrdersModule { }
