import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User.entity";
import { CartItem } from "./CartItem.entity";

@Entity({ name: "carts" })
export class Cart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({default: 0})
  totalQuantity: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0.00 })
  cartTotal: number;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @OneToMany(() => CartItem, (cartItem) => cartItem.cart, {
    nullable: true,
  })
  cartItems: CartItem[];
}
