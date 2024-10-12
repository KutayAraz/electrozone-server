import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from 'src/entities/Cart.entity';
import { CartItem } from 'src/entities/CartItem.entity';
import { User } from 'src/entities/User.entity';
import { Product } from 'src/entities/Product.entity';
import { CartService } from './services/cart.service';
import { CartUtilityService } from './services/cart-utility.service';
import { CartItemService } from './services/cart-item.service';
import { CommonValidationService } from 'src/common/services/common-validation.service';
import { SessionCartService } from './services/session-cart.service';
import { SessionCart } from 'src/entities/SessionCart.entity';
import { UserCartController } from './controllers/user-cart.controller';
import { SessionCartController } from './controllers/session-cart.controller';
import { BuyNowCartController } from './controllers/buy-now.controller';
import { BuyNowSessionCart } from 'src/entities/BuyNowSessionCart.entity';
import { BuyNowCartService } from './services/buy-now-cart.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, User, Product, SessionCart, BuyNowSessionCart])],
  controllers: [UserCartController, SessionCartController, BuyNowCartController],
  providers: [
    CartService,
    CartUtilityService,
    CartItemService,
    CommonValidationService,
    SessionCartService,
    BuyNowCartService
  ],
})
export class CartModule { }
