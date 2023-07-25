import { Module, ValidationPipe } from "@nestjs/common";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesModule } from "./categories/categories.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "./entities/User.entity";
import { Category } from "./entities/Category.entity";
import { ProductsModule } from "./products/products.module";
import { Subcategory } from "./entities/Subcategory.entity";
import { Product } from "./entities/Product.entity";
import { ReviewsModule } from "./reviews/reviews.module";
import { Review } from "./entities/Review.entity";
import { OrdersModule } from "./orders/orders.module";
import { Order } from "./entities/Order.entity";
import { APP_PIPE } from "@nestjs/core";
import { SubcategoriesModule } from './subcategories/subcategories.module';
import { OrderItem } from "./entities/OrderDetail.entity";
import { ProductImage } from "./entities/ProductImage.entity";
import { UserWishlist } from "./entities/UserWishlist.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          type: "mysql",
          host: config.get<string>("DB_HOST"),
          database: config.get<string>("DB_NAME"),
          port: config.get<number>("DB_PORT"),
          username: config.get<string>("DB_USERNAME"),
          password: config.get<string>("DB_PASSWORD"),
          synchronize: true,
          entities: [User, Category, Subcategory, Product, Review, Order, OrderItem, ProductImage, UserWishlist],
        };
      },
    }),
    UsersModule,
    CategoriesModule,
    ProductsModule,
    ReviewsModule,
    OrdersModule,
    SubcategoriesModule,
  ],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
      }),
    },
  ],
})
export class AppModule {}
