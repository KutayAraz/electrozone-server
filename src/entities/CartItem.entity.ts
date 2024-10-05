import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
} from "typeorm";
import { Cart } from "./Cart.entity";
import { Product } from "./Product.entity";
import { SessionCart } from "./SessionCart.entity";

@Entity({ name: "cart_items" })
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  quantity: number;

  @Column("decimal", { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  addedPrice: number;

  @ManyToOne(() => Product, (product) => product.cartItems)
  product: Product;

  @ManyToOne(() => Cart, (cart) => cart.cartItems, { nullable: true })
  cart: Cart;

  @ManyToOne(() => SessionCart, (sessionCart) => sessionCart.cartItems, { nullable: true })
  sessionCart: SessionCart;

  @UpdateDateColumn()
  updatedAt: Date;
}
