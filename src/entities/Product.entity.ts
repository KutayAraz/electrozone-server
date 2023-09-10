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
import { CartItem } from "./CartItem.entity";

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

  @Column("decimal", { precision: 10, scale: 1, nullable: true, default: null })
  averageRating: number;

  @Column("decimal", { precision: 10, scale: 2 })
  price: number;

  @Column()
  stock: number;

  @Column({default: 0})
  sold: number;

  @Column({default: 0})
  wishlisted: number;

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @OneToMany(() => ProductImage, (productImage) => productImage.product)
  productImages: ProductImage[];

  @ManyToOne(() => Subcategory, (subcategory) => subcategory.products)
  subcategory: Subcategory;

  @OneToMany(() => Wishlist, (wishlist) => wishlist.product)
  wishlists: Wishlist[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  @OneToMany(() => CartItem, (cartItem) => cartItem.product)
  cartItems: CartItem[];
}
