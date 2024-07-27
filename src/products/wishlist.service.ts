import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist.entity";
import { SubcategoriesService } from "src/subcategories/subcategories.service";
import { Repository } from "typeorm";

@Injectable()
export class WishlistService {
    constructor(
        @InjectRepository(Product) private productsRepo: Repository<Product>,
        @InjectRepository(User) private usersRepo: Repository<User>,
        @InjectRepository(Wishlist)
        private wishlistRepo: Repository<Wishlist>,
        private readonly subcategoriesService: SubcategoriesService
    ) { }
    async checkWishlist(productId: number, userId: number) {
        const wishlistItem = await this.wishlistRepo.findOne({
            where: {
                product: { id: productId },
                user: { id: userId },
            },
        });

        return !!wishlistItem;
    }

    async toggleWishlist(productId: number, userId: number) {
        return this.wishlistRepo.manager.transaction(async (transactionalEntityManager) => {
            const user = await transactionalEntityManager.findOne(User, {
                where: { id: userId },
                select: ["id"],
            });

            if (!user) {
                throw new NotFoundException("User not found");
            }

            const product = await transactionalEntityManager.findOne(Product, {
                where: { id: productId },
                select: ["id", "wishlisted"],
            });

            if (!product) {
                throw new NotFoundException("Product not found");
            }

            const wishlistItem = await transactionalEntityManager.findOne(Wishlist, {
                where: {
                    product: { id: productId },
                    user: { id: userId },
                },
            });

            let action: "added" | "removed";

            if (wishlistItem) {
                product.wishlisted--;
                await transactionalEntityManager.remove(wishlistItem);
                action = "removed";
            } else {
                product.wishlisted++;
                const newWishlistItem = transactionalEntityManager.create(Wishlist, {
                    product,
                    user,
                });
                await transactionalEntityManager.save(newWishlistItem);
                action = "added";
            }

            await transactionalEntityManager.save(product);

            return {
                status: "success",
                action,
                productId,
            };
        });
    }

}