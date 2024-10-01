import { MiddlewareConsumer, Module, NestModule, RequestMethod, ValidationPipe } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesModule } from "./categories/category.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { OrderModule } from "./orders/order.module";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { CartModule } from "./carts/cart.module";
import databaseConfig from "./config/database.config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { SubcategoryModule } from "./subcategories/subcategory.module";
import { AtGuard } from "./common/guards/at.guard";
import { UserModule } from "./users/user.module";
import { ProductModule } from "./products/product.module";
import { SessionMiddleware } from "./common/middleware/session.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,  // Time to live for the records in miliseconds
      limit: 10,  // Maximum number of requests within the TTL
    }]),
    UserModule,
    CategoriesModule,
    ProductModule,
    OrderModule,
    SubcategoryModule,
    CartModule,
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
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ],
})

export class AppModule {
  // configure(consumer: MiddlewareConsumer) {
  //   consumer
  //     .apply(SessionMiddleware)
  //     .forRoutes(
  //       { path: 'cart/session', method: RequestMethod.ALL },
  //     );
  // }
}
