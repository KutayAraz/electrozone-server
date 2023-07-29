import { IsArray, IsNumber } from "class-validator";
import { CreateOrderItemDTO } from "./create-order-item.dto";

export class CreateOrderDto {
  @IsArray()
  orderItems: CreateOrderItemDTO[];
}
