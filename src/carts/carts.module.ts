import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from 'src/entities/Cart.entity';
import { CartItem } from 'src/entities/CartItem.entity';
import { User } from 'src/entities/User.entity';
import { Product } from 'src/entities/Product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, User, Product])],
  controllers: [CartsController],
  providers: [CartsService]
})
export class CartsModule {}
