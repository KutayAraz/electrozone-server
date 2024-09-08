import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { Wishlist } from "src/entities/Wishlist.entity";
import { Repository, DataSource } from "typeorm";
import { WishlistItem } from "../types/wishlist-product.type";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { WishlistToggleResult } from "../types/wishlist-toggle-result.type";

@Injectable()
export class WishlistService {
    constructor(
        @InjectRepository(Wishlist)
        private readonly wishlistRepo: Repository<Wishlist>,
        private readonly dataSource: DataSource,
    ) { }

    async getUserWishlist(userUuid: string): Promise<WishlistItem[]> {
        const userWishlist = await this.wishlistRepo.createQueryBuilder("wishlist")
            .innerJoin("wishlist.user", "user")
            .innerJoin("wishlist.product", "product")
            .innerJoin("product.subcategory", "subcategory")
            .innerJoin("subcategory.category", "category")
            .where("user.uuid = :userUuid", { userUuid })
            .select([
                "product.id",
                "product.productName",
                "product.brand",
                "product.averageRating",
                "product.thumbnail",
                "product.price",
                "product.stock",
                "subcategory.subcategory",
                "category.category"
            ])
            .getRawMany();

        return userWishlist.map((wishlist) => {
            return {
                id: wishlist.product_id,
                productName: wishlist.product_productName,
                brand: wishlist.product_brand,
                averageRating: wishlist.product_averageRating,
                thumbnail: wishlist.product_thumbnail,
                price: wishlist.product_price,
                stock: wishlist.product_stock,
                subcategory: wishlist.subcategory_subcategory,
                category: wishlist.category_category,
            };
        });
    }

    async checkWishlist(productId: number, userUuid: string): Promise<boolean> {
        const count = await this.wishlistRepo.count({
            where: {
                product: { id: productId },
                user: { uuid: userUuid },
            },
        });

        return count > 0;
    }

    async toggleWishlist(productId: number, userUuid: string): Promise<WishlistToggleResult> {
        return this.dataSource.transaction(async (transactionalEntityManager) => {
            const [user, product] = await Promise.all([
                transactionalEntityManager.findOne(User, {
                    where: { uuid: userUuid },
                    select: ["id"],
                }),
                transactionalEntityManager.findOne(Product, {
                    where: { id: productId },
                    select: ["id", "wishlisted"],
                }),
            ]);

            if (!product) {
                throw new AppError(ErrorType.PRODUCT_NOT_FOUND, "Product not found");
            }

            const wishlistProduct = await transactionalEntityManager.findOne(Wishlist, {
                where: {
                    product: { id: productId },
                    user: { uuid: userUuid },
                },
            });

            let action: "added" | "removed";

            if (wishlistProduct) {
                product.wishlisted--;
                await transactionalEntityManager.remove(wishlistProduct);
                action = "removed";
            } else {
                product.wishlisted++;
                const newWishlistProduct = transactionalEntityManager.create(Wishlist, {
                    product,
                    user,
                });
                await transactionalEntityManager.save(newWishlistProduct);
                action = "added";
            }

            await transactionalEntityManager.save(product);

            return {
                action,
                productId,
            };
        });
    }

}