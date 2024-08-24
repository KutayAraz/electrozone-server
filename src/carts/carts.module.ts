import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from 'src/entities/Cart.entity';
import { CartItem } from 'src/entities/CartItem.entity';
import { User } from 'src/entities/User.entity';
import { Product } from 'src/entities/Product.entity';
import { CartCalculationsService } from './services/cart-calculations.service';
import { CartOperationsService } from './services/cart-operations.service';
import { CartQueriesService } from './services/cart-queries.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, User, Product])],
  controllers: [CartsController],
  providers: [CartCalculationsService, CartOperationsService, CartQueriesService]
})
export class CartsModule {}
