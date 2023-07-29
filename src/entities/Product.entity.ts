import {
  AfterInsert,
  AfterUpdate,
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Review } from "./Review.entity";
import { Subcategory } from "./Subcategory.entity";
import { ProductImage } from "./ProductImage.entity";
import { User } from "./User.entity";
import { OrderItem } from "./OrderItem.detail";

@Entity({ name: "products" })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productName: string;

  @Column()
  brand: string;

  @Column()
  description: string;

  @Column()
  thumbnail: string;

  @Column("decimal", { precision: 10, scale: 1 })
  averageRating: number;

  @Column("decimal", { precision: 10, scale: 2 })
  price: number;

  @Column()
  stock: number;

  @Column()
  sold: number;

  @Column({ nullable: true })
  wishlisted: number;

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @OneToMany(() => ProductImage, (productImage) => productImage.product)
  productImages: ProductImage[];

  @ManyToOne(() => Subcategory, (subcategory) => subcategory.products)
  subcategory: Subcategory;

  @ManyToMany(() => User, (user) => user.wishlist)
  wishlistedBy: User[];

  @OneToMany(() => OrderItem, orderItem => orderItem.product)
  orderItems: OrderItem[];

  @AfterInsert()
  updateAverageRating() {
    this.calculateAverageRating();
  }

  @AfterUpdate()
  updateAverageRatingAfterUpdate() {
    this.calculateAverageRating();
  }

  calculateAverageRating() {
    // Query reviews and calculate average
    if (this.reviews && this.reviews.length) {
      const sum = this.reviews.reduce((total, review) => {
        return total + review.rating;
      }, 0);
      return sum / this.reviews.length;
    } else {
      return null;
    }
  }
}
