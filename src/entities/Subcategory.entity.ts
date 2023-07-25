import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Product } from "./Product.entity";
import { Category } from "./Category.entity";

@Entity({ name: "subcategories" })
export class Subcategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subcategory: string;

  @ManyToOne(() => Category, (category) => category.subcategories)
  @JoinColumn({name: "categoryId"})
  category: Category;

  @OneToMany(() => Product, (product) => product.subcategory)
  products: Product[];
}
