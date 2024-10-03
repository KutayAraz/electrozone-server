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
import { CommonValidationService } from 'src/common/services/common-validation.service';
import { SessionCartService } from './services/session-cart.service';
import { SessionCart } from 'src/entities/SessionCart.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, User, Product, SessionCart])],
  controllers: [CartController],
  providers: [
    CartService,
    CartUtilityService,
    CartItemService,
    CartOperationsService,
    CommonValidationService,
    SessionCartService
  ],
  exports: [
    CartService,
  ]
})
export class CartModule { }
