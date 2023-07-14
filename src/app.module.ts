import { MiddlewareConsumer, Module, ValidationPipe } from "@nestjs/common";
import { AppController } from "./app.controller";
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
const cookieSession = require("cookie-session");

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
          entities: [User, Category, Subcategory, Product, Review, Order],
        };
      },
    }),
    UsersModule,
    CategoriesModule,
    ProductsModule,
    ReviewsModule,
    OrdersModule,
  ],
  controllers: [AppController],
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
export class AppModule {
  constructor(private readonly configService: ConfigService){}
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        cookieSession({
          keys: [this.configService.get<string>("COOKIE_SESSION_KEY")],
        }),
      )
      .forRoutes("*");
  }
}
