import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { CartItem } from "./CartItem.entity";
import { OrderItem } from "./OrderItem.entity";
import { ProductImage } from "./ProductImage.entity";
import { Review } from "./Review.entity";
import { Subcategory } from "./Subcategory.entity";
import { Wishlist } from "./Wishlist.entity";

@Entity({ name: "products" })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productName: string;

  @Column()
  brand: string;

  @Column("json", { nullable: true })
  description: string;

  @Column()
  thumbnail: string;

  @Column("varchar", { length: 3, nullable: true, default: null })
  averageRating: string;

  @Column("varchar", { length: 10 })
  price: string;

  @Column()
  stock: number;

  @Column({ default: 0 })
  sold: number;

  @Column({ default: 0 })
  wishlisted: number;

  @OneToMany(() => Review, review => review.product)
  reviews: Review[];

  @OneToMany(() => ProductImage, productImage => productImage.product)
  productImages: ProductImage[];

  @ManyToOne(() => Subcategory, subcategory => subcategory.products)
  subcategory: Subcategory;

  @OneToMany(() => Wishlist, wishlist => wishlist.product)
  wishlists: Wishlist[];

  @OneToMany(() => OrderItem, orderItem => orderItem.product)
  orderItems: OrderItem[];

  @OneToMany(() => CartItem, cartItem => cartItem.product)
  cartItems: CartItem[];
}
