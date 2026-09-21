import { IsUUID } from "class-validator";

export class ProcessOrderDto {
  @IsUUID()
  checkoutSnapshotId: string;

  @IsUUID()
  idempotencyKey: string;
}
