import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CartModule } from "src/carts/cart.module";
import { CommonValidationService } from "src/common/services/common-validation.service";
import { Order } from "src/entities/Order.entity";
import { OrderItem } from "src/entities/OrderItem.entity";
import { ProductModule } from "src/products/product.module";
import { OrderController } from "./order.controller";
import { OrderUtilityService } from "./services/order-utility.service";
import { OrderValidationService } from "./services/order-validation.service";
import { OrderService } from "./services/order.service";

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), CartModule, ProductModule],
  controllers: [OrderController],
  providers: [OrderService, CommonValidationService, OrderValidationService, OrderUtilityService],
})
export class OrderModule {}
