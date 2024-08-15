import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cart } from "src/entities/Cart.entity";
import { CartItem } from "src/entities/CartItem.entity";
import { Product } from "src/entities/Product.entity";
import { User } from "src/entities/User.entity";
import { EntityNotFoundError, In, Repository } from "typeorm";
import { CartItemDto } from "./dtos/cart-item.dto";
import { CartResponse } from "./types/cart-response.type";
import { FormattedCartProduct } from "./types/formatted-cart-product.type";

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart) private cartsRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemsRepo: Repository<CartItem>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) { }

  private readonly logger = new Logger(CartsService.name);

  async getUserCart(userId: number): Promise<CartResponse> {
    try {
      // Fetch cart with user in a single query
      const cart = await this.cartsRepo.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });
  
      if (!cart) {
        const user = await this.usersRepo.findOneBy({ id: userId });
        if (!user) {
          throw new NotFoundException('User not found');
        }
  
        const newCart = this.cartsRepo.create({
          user,
          cartTotal: 0,
          totalQuantity: 0,
        });
        await this.cartsRepo.save(newCart);
        return { cartTotal: 0, totalQuantity: 0, products: [] };
      }
  
      const products = await this.fetchCartProducts(cart.id);
  
      return {
        cartTotal: cart.cartTotal,
        totalQuantity: cart.totalQuantity,
        products,
      };
    } catch (error) {
      this.logger.error(`Error fetching user cart: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Unable to retrieve cart');
    }
  }
  
  private async fetchCartProducts(cartId: number): Promise<FormattedCartProduct[]> {
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
      .where("cartItem.cartId = :cartId", { cartId })
      .getMany();
  
    return products.map(product => ({
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
  }

  async getLocalCartInformation(products: CartItemDto[]) {
    if (!Array.isArray(products)) {
      throw new BadRequestException("Expected an array of products");
    }

    const productIds = products.map(product => product.productId);
    const foundProducts = await this.productsRepo.find({
      where: {
        id: In(productIds),
      },
      select: ['id', 'productName', 'thumbnail', 'price', 'brand', 'stock'],
      relations: ["subcategory", "subcategory.category"],
    });

    const productMap = new Map(foundProducts.map(product => [product.id, product]));
    const localCartProducts = [];
    const removedProducts = [];
    let cartTotal = 0;
    let totalQuantity = 0;

    for (const product of products) {
      const foundProduct = productMap.get(product.productId);
      if (!foundProduct) {
        console.warn(`Product with id ${product.productId} not found`);
        continue;
      }

      if (foundProduct.stock <= 0) {
        removedProducts.push(foundProduct.productName);
        continue;
      }

      const quantity = Math.min(product.quantity, foundProduct.stock);
      const amount = Number((foundProduct.price * quantity).toFixed(2));
      cartTotal += amount;
      totalQuantity += quantity;

      localCartProducts.push({
        id: product.productId,
        quantity,
        amount,
        productName: foundProduct.productName,
        thumbnail: foundProduct.thumbnail,
        price: foundProduct.price,
        brand: foundProduct.brand,
        subcategory: foundProduct.subcategory.subcategory,
        category: foundProduct.subcategory.category.category,
        stock: foundProduct.stock,
      });
    }

    const response: any = {
      cartTotal,
      totalQuantity,
      products: localCartProducts,
    };

    if (removedProducts.length > 0) {
      response.message = `The following out-of-stock items have been removed from your cart: ${removedProducts.join(', ')}`;
    }

    return response;
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
      product.amount = product.quantity * foundProduct.price;
      cart.totalQuantity += quantity;

      await this.cartItemsRepo.save(product);
      await this.cartsRepo.save(cart);
      return await this.getUserCart(userId);
    } else {
      const cartItem = new CartItem();
      cartItem.product = foundProduct;
      cartItem.quantity = quantity;
      cartItem.amount = quantity * foundProduct.price
      cartItem.cart = cart;
      cart.totalQuantity += quantity;
      cart.cartTotal = Number(cart.cartTotal) + Number(cartItem.amount);

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
      relations: ["products", "products.product"],
    });

    if (!backendCart) {
      backendCart = new Cart();
      backendCart.user = user;
      backendCart.cartItems = [];
      await this.cartsRepo.save(backendCart);
    }

    const existingItemsMap = new Map<number, CartItem>();
    backendCart.cartItems.forEach((item) => {
      existingItemsMap.set(item.product.id, item);
    });

    for (const localItem of localCartItems) {
      const existingProduct = existingItemsMap.get(localItem.productId);

      if (existingProduct) {
        const newQuantity = localItem.quantity + existingProduct.quantity;
        await this.updateCartItemQuantity(
          userId,
          localItem.productId,
          newQuantity,
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
    // Use a single query to get both cart and cart item
    const [cart, cartItem] = await Promise.all([
      this.cartsRepo.findOne({
        where: { user: { id: userId } },
      }),
      this.cartItemsRepo.findOne({
        where: { cart: { user: { id: userId } }, product: { id: productId } },
        relations: ["product"],
      })
    ]);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (cartItem) {
      // Check if the new quantity exceeds the stock
      if (quantity > cartItem.product.stock) {
        throw new BadRequestException('STOCK_EXCEEDED');
      }

      const oldQuantity = cartItem.quantity;
      const oldAmount = oldQuantity * cartItem.product.price;
      const newAmount = quantity * cartItem.product.price;

      // Update cart item
      cartItem.quantity = quantity;
      cartItem.amount = newAmount;

      // Update cart totals
      cart.totalQuantity += quantity - oldQuantity;
      cart.cartTotal += newAmount - oldAmount;

      // Save changes in a single transaction
      await this.cartsRepo.manager.transaction(async (transactionalEntityManager) => {
        await transactionalEntityManager.save(cartItem);
        await transactionalEntityManager.save(cart);
      });

      return await this.getUserCart(userId);
    } else {
      return await this.addProductToCart(userId, productId, quantity);
    }
  }

  async removeItemFromCart(userId: number, productId: number) {
    const [cart, productToRemove] = await Promise.all([
      this.cartsRepo.findOne({
        where: { user: { id: userId } },
      }),
      this.cartItemsRepo.findOne({
        where: { cart: { user: { id: userId } }, product: { id: productId } },
      }),
    ]);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (!productToRemove) {
      throw new NotFoundException('Product not found in cart');
    }

    cart.totalQuantity -= productToRemove.quantity;
    cart.cartTotal -= productToRemove.amount;

    await Promise.all([
      this.cartsRepo.save(cart),
      this.cartItemsRepo.remove(productToRemove),
    ]);

    return this.getUserCart(userId);
  }

  async clearCart(userId: number) {
    const cart = await this.cartsRepo.findOne({
      where: { user: { id: userId } },
      relations: ['cartItems'],
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    cart.cartTotal = 0;
    cart.totalQuantity = 0;
    cart.cartItems = [];

    await this.cartsRepo.save(cart);

    return { success: true, message: "Cart cleared successfully." };
  }
}
