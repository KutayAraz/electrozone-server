import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
} from "typeorm";
import { Order } from "./Order.entity";
import { Product } from "./Product.entity";

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  quantity: number;

  @Column()
  price: number;
  
  @ManyToOne(() => Order, (order) => order.orderItems)
  @JoinColumn({ name: "order_id" })
  order: Order;

//   @ManyToOne(() => Product, (product) => product.orderItems)
//   @JoinColumn({ name: "product_id" })
//   product: Product;
}
