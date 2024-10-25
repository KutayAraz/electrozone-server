import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Product } from './Product.entity';

@Entity()
export class BuyNowSessionCart {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    sessionId: string;

    @ManyToOne(() => Product)
    product: Product;

    @Column()
    quantity: number;

    @Column('varchar', { length: 10 })
    addedPrice: string;

    @Column('varchar', { length: 10 })
    total: string;

    @CreateDateColumn()
    createdAt: Date;
}