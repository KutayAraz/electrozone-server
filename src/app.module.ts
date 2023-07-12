import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesModule } from "./categories/categories.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "./entities/User.entity";
import { Category } from "./entities/Category.entity";
import { ProductsModule } from './products/products.module';
import { Subcategory } from "./entities/Subcategory.entity";
import { Product } from "./entities/Product.entity";

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
          entities: [User, Category, Subcategory, Product],
        };
      },
    }),
    UsersModule,
    CategoriesModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
