import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Order } from "./Order.entity";
import { Expose } from "class-transformer";
import { Product } from "./Product.entity";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  @Expose()
  id: number;

  @Column({ unique: true })
  @Expose()
  email: string;

  @Column()
  password: string;

  @Column()
  @Expose()
  firstName: string;

  @Column()
  @Expose()
  lastName: string;

  @Column()
  @Expose()
  address: string;

  @Column()
  @Expose()
  city: string;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @ManyToMany(() => Product, { cascade: true })
  @JoinTable()
  wishlist: Product[];
}
