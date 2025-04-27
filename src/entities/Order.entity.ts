import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OrderItem } from "./OrderItem.entity";
import { User } from "./User.entity";

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("varchar", { length: 10, default: 0 })
  orderTotal: string;

  @CreateDateColumn()
  orderDate: Date;

  @ManyToOne(() => User, user => user.orders)
  user: User;

  @OneToMany(() => OrderItem, orderItem => orderItem.order, {
    cascade: true,
    onDelete: "CASCADE",
  })
  orderItems: OrderItem[];

  @Column({ unique: true, nullable: true })
  idempotencyKey: string;
}
