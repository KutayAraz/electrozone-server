import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "./Order.entity";
import { Product } from "./Product.entity";

@Entity({ name: "order_items" })
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  quantity: number;

  @Column("varchar", { length: 10 })
  productPrice: string;

  @Column("varchar", { length: 10 })
  totalPrice: string;

  @ManyToOne(() => Order, order => order.orderItems, {
    onDelete: "CASCADE",
  })
  order: Order;

  @ManyToOne(() => Product, product => product.orderItems)
  product: Product;
}
