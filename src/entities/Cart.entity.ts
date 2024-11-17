import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User.entity";
import { CartItem } from "./CartItem.entity";

@Entity({ name: "carts" })
export class Cart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  totalQuantity: number;

  @Column("varchar", { length: 10 })
  cartTotal: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @OneToMany(() => CartItem, cartItem => cartItem.cart, {
    nullable: true,
  })
  cartItems: CartItem[];
}
