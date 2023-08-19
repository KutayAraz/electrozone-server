import { Module, ValidationPipe } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesModule } from "./categories/categories.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "./entities/User.entity";
import { Category } from "./entities/Category.entity";
import { ProductsModule } from "./products/products.module";
import { Subcategory } from "./entities/Subcategory.entity";
import { Product } from "./entities/Product.entity";
import { Review } from "./entities/Review.entity";
import { OrdersModule } from "./orders/orders.module";
import { Order } from "./entities/Order.entity";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { SubcategoriesModule } from "./subcategories/subcategories.module";
import { OrderItem } from "./entities/OrderItem.detail";
import { ProductImage } from "./entities/ProductImage.entity";
import { Wishlist } from "./entities/Wishlist";
import { AtGuard } from "./common/guards";
import { CartsModule } from './carts/carts.module';
import { Cart } from "./entities/Cart.entity";
import { CartItem } from "./entities/CartItem.entity";

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
          extra: {
            decimalNumbers: true
          },
          entities: [
            User,
            Category,
            Subcategory,
            Product,
            Review,
            Order,
            OrderItem,
            ProductImage,
            Wishlist,
            Cart,
            CartItem
          ],
        };
      },
    }),
    UsersModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    SubcategoriesModule,
    CartsModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
      }),
    },
    {
      provide: APP_GUARD,
      useClass: AtGuard,
    },
  ],
})
export class AppModule {}
