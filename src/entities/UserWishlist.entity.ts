import { Entity, PrimaryGeneratedColumn, ManyToOne } from "typeorm";
import { Product } from "./Product.entity";
import { User } from "./User.entity";

@Entity({name: "user_wishlist"})
export class UserWishlist {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.wishlist)
  user: User;

  @ManyToOne(() => Product, (product) => product.wishlistedBy)
  product: Product;
}
