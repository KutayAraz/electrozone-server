import { Entity, PrimaryGeneratedColumn, ManyToOne } from "typeorm";
import { Product } from "./Product.entity";
import { User } from "./User.entity";

@Entity({ name: "wishlists" })
export class Wishlist {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.wishlists)
  user: User;

  @ManyToOne(() => Product, product => product.wishlisted)
  product: Product;
}
