import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from 'src/entities/Cart.entity';
import { CartItem } from 'src/entities/CartItem.entity';
import { User } from 'src/entities/User.entity';
import { Product } from 'src/entities/Product.entity';
import { CartOperationsService } from './services/cart-operations.service';
import { CartService } from './services/carts.service';
import { CartValidationService } from './services/cart-validation.service';
import { CartHelperService } from './services/cart-helper.service';
import { CartItemService } from './services/cart-item.service';
import { LocalCartService } from './services/local-cart.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, User, Product])],
  controllers: [CartController],
  providers: [CartService, CartValidationService, CartHelperService, CartItemService, CartOperationsService, LocalCartService]
})
export class CartModule { }
