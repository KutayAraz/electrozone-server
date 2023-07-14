import { Expose, Transform } from "class-transformer";

export class OrderDto {
  @Expose()
  id: number;

  @Expose()
  orderTotal: number;

  @Expose()
  approved: boolean;

  @Transform(({ obj }) => obj.user.id)
  @Expose()
  userId: number;

  @Transform(({ obj }) => obj.user.email)
  @Expose()
  userEmail: string;
}
