import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cart } from 'src/entities/Cart.entity';
import { CartItem } from 'src/entities/CartItem.entity';
import { Category } from 'src/entities/Category.entity';
import { Order } from 'src/entities/Order.entity';
import { OrderItem } from 'src/entities/OrderItem.detail';
import { Product } from 'src/entities/Product.entity';
import { ProductImage } from 'src/entities/ProductImage.entity';
import { Review } from 'src/entities/Review.entity';
import { Subcategory } from 'src/entities/Subcategory.entity';
import { User } from 'src/entities/User.entity';
import { Wishlist } from 'src/entities/Wishlist.entity';
import { SessionCart } from 'src/entities/SessionCart.entity';

export default (config: ConfigService): TypeOrmModuleOptions => ({
    type: 'mysql',
    host: config.get<string>('DB_HOST'),
    port: config.get<number>('DB_PORT'),
    username: config.get<string>('DB_USERNAME'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_NAME'),
    entities: [
        User,
        Category,
        Subcategory,
        Product,
        Review,
        Order,
        OrderItem,
        ProductImage,
        Wishlist,
        Cart,
        CartItem,
        SessionCart,
    ],
    synchronize: config.get<string>('NODE_ENV') !== 'production',
    ssl: config.get<string>('NODE_ENV') === 'production' ? {
        require: true,
        rejectUnauthorized: true, // Ensure certificate validity in production
    } : undefined,
});
