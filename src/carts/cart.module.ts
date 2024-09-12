import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from 'src/entities/Cart.entity';
import { CartItem } from 'src/entities/CartItem.entity';
import { User } from 'src/entities/User.entity';
import { Product } from 'src/entities/Product.entity';
import { CartOperationsService } from './services/cart-operations.service';
import { CartService } from './services/cart.service';
import { CartUtilityService } from './services/cart-utility.service';
import { CartItemService } from './services/cart-item.service';
import { LocalCartService } from './services/local-cart.service';
import { CommonValidationService } from 'src/common/services/common-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, User, Product])],
  controllers: [CartController],
  providers: [
    CartService,
    CartUtilityService,
    CartItemService,
    CartOperationsService,
    LocalCartService,
    CommonValidationService],
  exports: [
    CartService,
  ]
})
export class CartModule { }
