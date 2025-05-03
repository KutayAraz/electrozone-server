import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.entity";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { Subcategory } from "src/entities/Subcategory.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist.entity";
import { SubcategoryService } from "src/subcategories/subcategory.service";
import { UserService } from "src/users/services/user.service";
import { ProductController } from "./controllers/product.controller";
import { ReviewController } from "./controllers/review.controller";
import { WishlistController } from "./controllers/wishlist.controller";
import { ProductService } from "./services/product.service";
import { ReviewService } from "./services/review.service";
import { WishlistService } from "./services/wishlist.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, User, Wishlist, Review, Order, OrderItem, Subcategory]),
  ],
  controllers: [ProductController, ReviewController, WishlistController],
  providers: [
    ProductService,
    ReviewService,
    SubcategoryService,
    WishlistService,
    UserService,
    CommonValidationService,
  ],
})
export class ProductModule {}
