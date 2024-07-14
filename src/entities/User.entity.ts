import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Order } from "./Order.entity";
import { Exclude } from "class-transformer";
import { Review } from "./Review.entity";
import { Wishlist } from "./Wishlist.entity";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  address: string;

  @Column()
  city: string;

  @Column({ nullable: true })
  hashedRt: string;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Wishlist, (wishlist) => wishlist.user)
  wishlists: Wishlist[];

  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];
}
