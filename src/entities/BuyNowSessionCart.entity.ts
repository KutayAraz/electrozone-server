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

    @Column('decimal', { precision: 10, scale: 2 })
    addedPrice: number;

    @Column('decimal', { precision: 10, scale: 2 })
    total: number;

    @CreateDateColumn()
    createdAt: Date;
}