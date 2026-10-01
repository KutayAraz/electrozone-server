import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from "typeorm";
import { Product } from "./Product.entity";

@Entity()
export class BuyNowSessionCart {
  @PrimaryGeneratedColumn()
  id: number;

  @Index("IDX_buy_now_session_cart_sessionId")
  @Column()
  sessionId: string;

  @ManyToOne(() => Product)
  product: Product;

  @Column()
  quantity: number;

  @Column("varchar", { length: 10 })
  addedPrice: string;

  @Column("varchar", { length: 10 })
  total: string;

  @CreateDateColumn()
  createdAt: Date;
}
