import { MiddlewareConsumer, Module, RequestMethod, ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CartModule } from "./carts/cart.module";
import { CategoriesModule } from "./categories/category.module";
import { AtGuard } from "./common/guards/at.guard";
import { SessionMiddleware } from "./common/middleware/session.middleware";
import databaseConfig from "./config/database.config";
import { OrderModule } from "./orders/order.module";
import { ProductModule } from "./products/product.module";
import { RedisModule } from "./redis/redis.module";
import { SubcategoryModule } from "./subcategories/subcategory.module";
import { UserModule } from "./users/user.module";

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
    RedisModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time to live for the records in miliseconds
        limit: 50, // Maximum number of requests within the TTL
      },
    ]),
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
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SessionMiddleware)
      .forRoutes(
        { path: "cart/session", method: RequestMethod.ALL },
        { path: "order/initiate-order", method: RequestMethod.POST },
      );
  }
}
