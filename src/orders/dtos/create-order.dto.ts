import { IsArray } from "class-validator";
import { OrderItemDTO } from "./order-item.dto";

export class CreateOrderDto {
  @IsArray()
  orderItems: OrderItemDTO[];
}
