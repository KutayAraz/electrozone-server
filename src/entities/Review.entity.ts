import {
  AfterInsert,
  AfterUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Product } from "./Product.entity";
import { User } from "./User.entity";

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
  
  @ManyToOne(() => User, (user) => user.reviews)
  @JoinColumn()
  user: User;

  @AfterInsert()
  updateProductRating() {
    this.product.calculateAverageRating();
  }

  @AfterUpdate()
  updateProductRatingAfterUpdate() {
    this.product.calculateAverageRating();
  }
}
