import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./Product.entity";

@Entity({ name: "product_images" })
export class ProductImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productImage: string;

  @ManyToOne(() => Product, product => product.productImages)
  product: Product;
}
