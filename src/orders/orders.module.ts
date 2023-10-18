import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { User } from "src/entities/User.entity";
import { Product } from "src/entities/Product.entity";
import { Cart } from "src/entities/Cart.entity";
import { CartsService } from "src/carts/carts.service";
import { CartItem } from "src/entities/CartItem.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User, Product, Cart, CartItem]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, CartsService],
})
export class OrdersModule {}
