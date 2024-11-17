import { BeforeInsert, Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "./Order.entity";
import { Exclude } from "class-transformer";
import { Review } from "./Review.entity";
import { Wishlist } from "./Wishlist.entity";
import { v4 as uuidv4 } from "uuid";
import { UserRole } from "src/users/types/user-role.enum";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index("IDX_user_uuid", { unique: true })
  @Column({ type: "char", length: 36, unique: true })
  uuid: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  address: string;

  @Column()
  city: string;

  @Column({ nullable: true })
  hashedRt: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @OneToMany(() => Order, order => order.user)
  orders: Order[];

  @OneToMany(() => Wishlist, wishlist => wishlist.user)
  wishlists: Wishlist[];

  @OneToMany(() => Review, review => review.user)
  reviews: Review[];

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) {
      this.uuid = uuidv4();
    }
  }
}
