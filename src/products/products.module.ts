import { Logger, Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist";
import { Review } from "src/entities/Review.entity";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.detail";
import { Subcategory } from "src/entities/Subcategory.entity";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { OpensearchModule } from "nestjs-opensearch";

@Module({
  imports: [
    OpensearchModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        node: config.get("OPENSEARCH_NODE"),
        auth: {
          username: config.get("OPENSEARCH_USER"),
          password: config.get("OPENSEARCH_PASSWORD"),
        },
      }),
    }),
    TypeOrmModule.forFeature([
      Product,
      User,
      Wishlist,
      Review,
      Order,
      OrderItem,
      Subcategory,
    ]),
    ConfigModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
