import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User.entity";

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderTotal: number;

  @Column({ default: false })
  approved: boolean;

  @ManyToOne(() => User, (user) => user.orders)
  user: User;
}
