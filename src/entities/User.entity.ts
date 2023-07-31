import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Order } from "./Order.entity";
import { Product } from "./Product.entity";
import { Exclude, Expose } from "class-transformer";
import { Review } from "./Review.entity";

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

  @Column({nullable: true})
  hashedRt: string;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @ManyToMany(() => Product, { cascade: true })
  @JoinTable()
  wishlist: Product[];

  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];
}
