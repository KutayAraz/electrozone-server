import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "subcategories" })
export class Subcategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subcategory: string;
}
