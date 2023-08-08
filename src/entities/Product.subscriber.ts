import { OpensearchClient } from "nestjs-opensearch";
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from "typeorm";
import { Product } from "./Product.entity";

@EventSubscriber()
export class ProductSubscriber implements EntitySubscriberInterface {
  constructor(private opensearchService: OpensearchClient) {}

  async afterInsert(event: InsertEvent<Product>) {
    const doc = {
      id: event.entity.id,
      productName: event.entity.productName,
      brand: event.entity.brand,
      description: event.entity.description,
    };
    await this.opensearchService.index({
      index: "products",
      body: doc,
    });
  }
}
