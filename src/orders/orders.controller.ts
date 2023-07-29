import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  SerializeOptions,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { User } from "src/entities/User.entity";
import { CurrentUser } from "src/users/decorators/current-user.decorator";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { OrdersService } from "./orders.service";
import { Serialize } from "src/interceptors/serialize.interceptor";
import { OrderDto } from "./dtos/order.dto";
import { JwtGuard } from "src/users/guards/jwt-auth.guard";
import { UserDto } from "src/users/dtos/user.dto";

@Controller("orders")
@UseInterceptors(ClassSerializerInterceptor)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @UseGuards(JwtGuard)
  @Post()
  createOrder(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: User) {
    return this.ordersService.createOrder(
      user.id,
      createOrderDto.orderItems,
    );
  }

  // @Get(":id")
  // async getOrder(@Param("id") id: number) {
  //   return this.ordersService.getOrderById(id);
  // }

  @UseGuards(JwtGuard)
  @Get()
  async getCurrent(@CurrentUser() user: User){
    console.log(user.firstName + "hello" + user.lastName)
    return user;
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @Get("user/:userId")
  async getOrdersForUser(@CurrentUser() user: User) {
    return this.ordersService.getOrdersForUser(user.id);
  }

  @UseGuards(JwtGuard)
  @Get("/user")
  async getUser(@CurrentUser() user: User) {
    console.log(user)
    if (user){
      return user.id;
    } else {
      return console.log("doesnt work");
    }
  }
}
