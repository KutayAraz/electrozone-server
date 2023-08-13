import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Product } from "./Product.entity";
import { User } from "./User.entity";

@Entity({ name: "reviews" })
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  reviewDate: Date;

  @Column("decimal", { precision: 10, scale: 1,})
  rating: number;

  @Column()
  comment: string;

  @ManyToOne(() => Product, (product) => product.reviews)
  product: Product;

  @ManyToOne(() => User, (user) => user.reviews)
  @JoinColumn()
  user: User;
}
