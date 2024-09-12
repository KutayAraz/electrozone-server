import { IsArray } from "class-validator";
import { CreateOrderItemDTO } from "./order-item.dto";

export class CreateOrderDto {
  @IsArray()
  orderItems: CreateOrderItemDTO[];
}
