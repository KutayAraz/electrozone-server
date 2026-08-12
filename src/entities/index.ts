import { BuyNowSessionCart } from "./BuyNowSessionCart.entity";
import { Cart } from "./Cart.entity";
import { CartItem } from "./CartItem.entity";
import { Category } from "./Category.entity";
import { Order } from "./Order.entity";
import { OrderItem } from "./OrderItem.entity";
import { Product } from "./Product.entity";
import { ProductImage } from "./ProductImage.entity";
import { Review } from "./Review.entity";
import { SessionCart } from "./SessionCart.entity";
import { Subcategory } from "./Subcategory.entity";
import { User } from "./User.entity";
import { Wishlist } from "./Wishlist.entity";

export const entities = [
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
  BuyNowSessionCart,
];
