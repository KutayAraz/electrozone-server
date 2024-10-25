import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { CartItem } from "./CartItem.entity";

@Entity({ name: "session_carts" })
export class SessionCart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  sessionId: string;

  @Column({ default: 0 })
  totalQuantity: number;

  @Column("varchar", { length: 10, default: 0.0 })
  cartTotal: string;

  @OneToMany(() => CartItem, (cartItem) => cartItem.sessionCart, {
    nullable: true,
  })
  cartItems: CartItem[];
}
