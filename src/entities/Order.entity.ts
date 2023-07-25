import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User.entity";
import { OrderItem } from "./OrderDetail.entity";

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderTotal: number;

  @ManyToOne(() => User, (user) => user.orders)
  user: User;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  orderItems: OrderItem[];
}
