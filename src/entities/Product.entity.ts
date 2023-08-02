import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Review } from "./Review.entity";
import { Subcategory } from "./Subcategory.entity";
import { ProductImage } from "./ProductImage.entity";
import { OrderItem } from "./OrderItem.detail";
import { Wishlist } from "./Wishlist";

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

  @Column("decimal", { precision: 10, scale: 1, nullable: false })
  averageRating: number;

  @Column("decimal", { precision: 10, scale: 2 })
  price: number;

  @Column()
  stock: number;

  @Column()
  sold: number;

  @Column()
  wishlisted: number;

  @OneToMany(() => Review, (review) => review.product, { eager: true })
  reviews: Review[];

  @OneToMany(() => ProductImage, (productImage) => productImage.product)
  productImages: ProductImage[];

  @ManyToOne(() => Subcategory, (subcategory) => subcategory.products)
  subcategory: Subcategory;

  @OneToMany(() => Wishlist, (wishlist) => wishlist.product)
  wishlists: Wishlist[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];
}
