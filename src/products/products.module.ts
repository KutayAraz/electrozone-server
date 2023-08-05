import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist";
import { Review } from "src/entities/Review.entity";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { Subcategory } from "src/entities/Subcategory.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      User,
      Wishlist,
      Review,
      Order,
      OrderItem,
      Subcategory
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
