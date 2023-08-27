import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { EntityNotFoundError, Repository } from "typeorm";
import { CartItemDto } from "./dtos/cart-item.dto";

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart) private cartsRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemsRepo: Repository<CartItem>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) {}

  async getUserCart(userId: number) {
    let cart;

    try {
      cart = await this.cartsRepo.findOneOrFail({
        where: { user: { id: userId } },
      });
    } catch (error) {
      // Handle the error (if it's related to not finding the cart)
      if (error instanceof EntityNotFoundError) {
        const user = await this.usersRepo.findOneByOrFail({ id: userId });
        cart = this.cartsRepo.create({
          user: user,
          cartTotal: 0,
          totalQuantity: 0,
          // Add other necessary initializations if needed
        });
        await this.cartsRepo.save(cart);
      } else {
        // If it's another type of error, rethrow it.
        throw error;
      }
    }

    const products = await this.cartItemsRepo
      .createQueryBuilder("cartItem")
      .innerJoinAndSelect("cartItem.product", "product")
      .where("cartItem.cartId = :cartId", { cartId: cart.id })
      .getMany();

    return {
      cartTotal: cart.cartTotal,
      totalQuantity: cart.totalQuantity,
      products: products,
    };
  }

  async getLocalCartInformation(products: CartItemDto[]) {
    if (!Array.isArray(products)) {
      throw new Error("Expected an array of products");
    }
  
    let cartTotal = 0;
  
    const localCartProductsPromises = products.map(async (product) => {
      const foundProduct = await this.productsRepo.findOneBy({ id: product.productId });
      const productTotal = foundProduct.price * product.quantity;
      cartTotal += productTotal;
      return {
        ...foundProduct,
        quantity: product.quantity,
        productTotal
      };
    });
  
    const localCartProducts = await Promise.all(localCartProductsPromises);
  
    return { cartTotal, localCartProducts };
  }
  
  async addProductToCart(userId: number, productId: number, quantity: number) {
    const user = await this.usersRepo.findOneBy({ id: userId });
    let cart = await this.cartsRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!cart) {
      cart = new Cart();
      cart.user = user;
      await this.cartsRepo.save(cart);
    }
    let product = await this.cartItemsRepo.findOne({
      where: { cart, product: { id: productId } },
      relations: ["product"],
    });
    const foundProduct = await this.productsRepo.findOneBy({
      id: productId,
    });

    if (product) {
      product.quantity += quantity;
      product.amount = quantity * foundProduct.price;
      await this.cartItemsRepo.save(product);
      return await this.getUserCart(userId);
    } else {
      const cartItem = new CartItem();
      cartItem.product = foundProduct;
      cartItem.quantity = quantity;
      cartItem.amount = Number((quantity * foundProduct.price).toFixed(2));
      cartItem.cart = cart;
      cart.totalQuantity += quantity;
      cart.cartTotal += cartItem.amount;

      await this.cartsRepo.save(cart);
      await this.cartItemsRepo.save(cartItem);
      return await this.getUserCart(userId);
    }
  }

  async updateCartItemQuantity(
    userId: number,
    productId: number,
    quantity: number,
  ) {
    const cart = await this.cartsRepo.findOne({
      where: { user: { id: userId } },
    });

    const productToUpdate = await this.cartItemsRepo.findOne({
      where: { cart, product: { id: productId } },
      relations: ["product"],
    });

    if (productToUpdate) {
      const oldQuantity = productToUpdate.quantity;
      productToUpdate.quantity = quantity;
      productToUpdate.amount = quantity * productToUpdate.product.price;
      cart.totalQuantity += quantity - oldQuantity;
      cart.cartTotal +=
        productToUpdate.amount - oldQuantity * productToUpdate.product.price;

      await this.cartItemsRepo.save(productToUpdate);
      await this.cartsRepo.save(cart);
      return await this.getUserCart(userId);
    } else {
      return await this.addProductToCart(userId, productId, quantity);
    }
  }

  async removeItemFromCart(userId: number, productId: number) {
    const cart = await this.cartsRepo.findOne({
      where: { user: { id: userId } },
    });

    const productToRemove = await this.cartItemsRepo
      .createQueryBuilder("cartItem")
      .where("cartItem.cartId = :cartId", { cartId: cart.id })
      .andWhere("cartItem.productId = :productId", { productId })
      .getOne();

    if (productToRemove) {
      cart.totalQuantity -= productToRemove.quantity;
      cart.cartTotal -= productToRemove.amount;

      await this.cartsRepo.save(cart);
      await this.cartItemsRepo.delete(productToRemove);
      return await this.getUserCart(userId);
    }
  }

  async clearCart(userId: number) {
    try {
      const user = await this.usersRepo.findOneBy({ id: userId });
      const cart = await this.cartsRepo.findOne({ where: { user } });

      cart.cartTotal = 0;
      cart.totalQuantity = 0;

      await this.cartsRepo.save(cart);
      await this.cartItemsRepo.delete({ cart });

      return { success: true, message: "Cart cleared successfully." };
    } catch (error) {
      return { success: false, message: "Failed to clear the cart." };
    }
  }
}