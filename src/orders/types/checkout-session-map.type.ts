import { CheckoutSnapshot } from "./checkout-snapshot.type";

export interface CheckoutSessionMap {
  [userUuid: string]: CheckoutSnapshot;
}
