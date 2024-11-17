import { Module } from "@nestjs/common";
import { ProductController } from "./controllers/product.controller";
import { ProductService } from "./services/product.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist.entity";
import { Review } from "src/entities/Review.entity";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { Subcategory } from "src/entities/Subcategory.entity";
import { SubcategoryService } from "src/subcategories/subcategory.service";
import { WishlistService } from "./services/wishlist.service";
import { ReviewController } from "./controllers/review.controller";
import { ReviewService } from "./services/review.service";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { WishlistController } from "./controllers/wishlist.controller";
import { UserService } from "src/users/services/user.service";

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
  controllers: [ProductController, ReviewController, WishlistController],
  providers: [ProductService, ReviewService, SubcategoryService, WishlistService, UserService, CommonValidationService],
})
export class ProductModule { }
