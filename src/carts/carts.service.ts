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
    let cart: Cart;

    try {
      cart = await this.cartsRepo.findOneOrFail({
        where: { user: { id: userId } },
      });
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        const user = await this.usersRepo.findOneByOrFail({ id: userId });
        cart = this.cartsRepo.create({
          user: user,
          cartTotal: 0,
          totalQuantity: 0,
        });
        await this.cartsRepo.save(cart);
      } else {
        throw error;
      }
    }

    const products = await this.cartItemsRepo
      .createQueryBuilder("cartItem")
      .select([
        "cartItem.id",
        "cartItem.quantity",
        "cartItem.amount",
        "product.productName",
        "product.averageRating",
        "product.thumbnail",
        "product.price",
        "product.id",
        "product.stock",
        "subcategory.subcategory",
        "category.category",
      ])
      .innerJoin("cartItem.product", "product")
      .innerJoin("product.subcategory", "subcategory")
      .innerJoin("subcategory.category", "category")
      .where("cartItem.cartId = :cartId", { cartId: cart.id })
      .getMany();

    const formattedProducts = products.map((product) => ({
      cartItemId: product.id,
      quantity: product.quantity,
      amount: product.amount,
      id: product.product.id,
      productName: product.product.productName,
      avgRating: product.product.averageRating,
      thumbnail: product.product.thumbnail,
      price: product.product.price,
      subcategory: product.product.subcategory.subcategory,
      category: product.product.subcategory.category.category,
    }));

    return {
      cartTotal: cart.cartTotal,
      totalQuantity: cart.totalQuantity,
      products: formattedProducts,
    };
  }

  async getLocalCartInformation(products: CartItemDto[]) {
    if (!Array.isArray(products)) {
      throw new Error("Expected an array of products");
    }

    let cartTotal = 0;
    let totalQuantity = 0;

    const localCartProductsPromises = products.map(async (product) => {
      const foundProduct = await this.productsRepo.findOne({
        where: {
          id: product.productId,
        },
        relations: ["subcategory", "subcategory.category"],
      });

      if (!foundProduct) {
        throw new Error(`Product with id ${product.productId} not found`);
      }

      const amount = Number((foundProduct.price * product.quantity).toFixed(2));

      cartTotal += amount;
      totalQuantity += product.quantity;

      return {
        id: product.productId,
        quantity: product.quantity,
        amount,
        productName: foundProduct.productName,
        thumbnail: foundProduct.thumbnail,
        price: foundProduct.price,
        brand: foundProduct.brand,
        subcategory: foundProduct.subcategory.subcategory,
        category: foundProduct.subcategory.category.category,
      };
    });

    const localCartProducts = await Promise.all(localCartProductsPromises);

    return {
      cartTotal,
      totalQuantity,
      products: localCartProducts,
    };
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

  async getBuyNowCartInfo(productId: number, quantity: number) {
    const foundProduct = await this.productsRepo.findOneOrFail({
      where: {
        id: productId,
      },
      relations: ["subcategory", "subcategory.category"],
    });

    const amount = Number((foundProduct.price * quantity).toFixed(2));
    const cartTotal = amount;
    const totalQuantity = quantity;

    const product = {
      id: foundProduct.id,
      quantity: totalQuantity,
      amount,
      productName: foundProduct.productName,
      thumbnail: foundProduct.thumbnail,
      price: foundProduct.price,
      brand: foundProduct.brand,
      subcategory: foundProduct.subcategory.subcategory,
      category: foundProduct.subcategory.category.category,
    };

    return {
      cartTotal,
      totalQuantity,
      products: [product],
    };
  }

  async mergeLocalWithBackendCart(
    userId: number,
    localCartItems: CartItemDto[],
  ) {
    const user = await this.usersRepo.findOneBy({ id: userId });

    let backendCart = await this.cartsRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!backendCart) {
      backendCart = new Cart();
      backendCart.user = user;
      await this.cartsRepo.save(backendCart);
    }

    for (const localItem of localCartItems) {
      const existingProduct = await this.cartItemsRepo.findOne({
        where: { cart: backendCart, product: { id: localItem.productId } },
        relations: ["product"],
      });

      if (existingProduct) {
        await this.updateCartItemQuantity(
          userId,
          localItem.productId,
          localItem.quantity + existingProduct.quantity,
        );
      } else {
        await this.addProductToCart(
          userId,
          localItem.productId,
          localItem.quantity,
        );
      }
    }
    return await this.getUserCart(userId);
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
