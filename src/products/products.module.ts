import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist.entity";
import { Review } from "src/entities/Review.entity";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { Subcategory } from "src/entities/Subcategory.entity";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { SubcategoriesService } from "src/subcategories/subcategories.service";
import { WishlistService } from "./wishlist.service";

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
  controllers: [ProductsController, ReviewsController],
  providers: [ProductsService, ReviewsService, SubcategoriesService, WishlistService],
})
export class ProductsModule {}
