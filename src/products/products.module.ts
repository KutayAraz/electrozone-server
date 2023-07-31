import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { UserWishlist } from "src/entities/UserWishlist.entity";
import { Review } from "src/entities/Review.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Product, User, UserWishlist, Review])],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
