import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./Product.entity";

@Entity({ name: "reviews" })
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  reviewDate: Date;

  @Column()
  rating: number;

  @Column()
  comment: string;

  @ManyToOne(() => Product, (product) => product.reviews)
  product: Product;
}
