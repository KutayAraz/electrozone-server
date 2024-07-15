import { Module, ValidationPipe } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesModule } from "./categories/categories.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { SubcategoriesModule } from "./subcategories/subcategories.module";
import { AtGuard } from "./common/guards";
import { CartsModule } from "./carts/carts.module";
import databaseConfig from "./config/database.config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

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
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ],
})
export class AppModule { }
