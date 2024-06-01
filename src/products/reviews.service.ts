import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "src/entities/Order.entity";
import { Product } from "src/entities/Product.entity";
import { Review } from "src/entities/Review.entity";
import { User } from "src/entities/User.entity";
import { Repository } from "typeorm";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(Review) private reviewsRepo: Repository<Review>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
  ) { }

  async getReviewsByProductId(
    productId: number,
  ): Promise<any> {
    let query = this.reviewsRepo
      .createQueryBuilder('review')
      .select([
        'review.id',
        'review.reviewDate',
        'review.rating',
        'review.comment',
        'user.firstName',
        'user.lastName'
      ])
      .innerJoin('review.user', 'user')
      .orderBy('review.reviewDate', 'DESC')
      .where("review.productId = :productId", { productId });
  
    const reviews = await query.getMany();
  
    // Get count of all ratings from 1 to 5 for the specified product
    const ratingsCountRaw = await this.reviewsRepo
      .createQueryBuilder('review')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where("review.productId = :productId", { productId })
      .groupBy('review.rating')
      .getRawMany();
  
    const ratingsCount = [];
    for (let i = 5; i >= 1; i--) {
      const ratingEntry = ratingsCountRaw.find(rc => parseInt(rc.rating) === i);
      ratingsCount.push({
        review_rating: i,
        count: ratingEntry ? ratingEntry.count : '0' // Default to '0' if no entries found
      });
    }
  
    const transformedReviews = reviews.map(review => ({
      id: review.id,
      reviewDate: review.reviewDate,
      rating: review.rating,
      comment: review.comment,
      user: {
        firstName: `${review.user.firstName.charAt(0)}.`,
        lastName: `${review.user.lastName.charAt(0)}.`
      }
    }));
  
    return {
      reviews: transformedReviews,
      ratingsDistribution: ratingsCount
    };
  }  

  async canCurrentUserReview(selectedProductId: number, userId: number) {
    const orders = await this.ordersRepo
      .createQueryBuilder("order")
      .innerJoin("order.orderItems", "orderItem")
      .where("order.user.id = :userId", { userId })
      .select("orderItem.product.id", "productId")
      .getRawMany();

    const hasOrderedProduct = orders.some(
      ({ productId }) => productId === selectedProductId,
    );

    if (!hasOrderedProduct) {
      return false;
    }

    const reviews = await this.reviewsRepo.find({
      where: {
        product: { id: selectedProductId },
        user: { id: userId },
      },
    });

    if (reviews.length > 0) {
      return false;
    } else {
      return true;
    }
  }

  async addReview(
    productId: number,
    userId: number,
    rating: number,
    comment: string,
  ): Promise<any> {
    const product = await this.productsRepo.findOneOrFail({
      where: { id: productId },
      relations: ["reviews"],
    });
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    await this.canCurrentUserReview(productId, userId);
    const review = new Review();
    review.product = product;
    review.user = user;
    review.rating = rating;
    review.comment = comment;
    await this.productsRepo.save(product);
    await this.reviewsRepo.save(review);

    const updatedProduct = await this.productsRepo.findOneOrFail({
      where: { id: productId },
      relations: ["reviews"],
    });

    const ratingTotal = updatedProduct.reviews.reduce((total, review) => {
      return total + review.rating;
    }, 0);

    const newRating = ratingTotal / updatedProduct.reviews.length;

    updatedProduct.averageRating = newRating;
    await this.productsRepo.save(updatedProduct);

    return newRating;
  }
}
