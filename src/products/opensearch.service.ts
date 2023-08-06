// opensearch.service.ts

import { Injectable } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";

@Injectable()
export class OpenSearchService {
  client: Client;

  constructor() {
    this.client = new Client({
      node: "https://search-electrozone-hjkvc55vcca2elrazvcp7olyue.eu-north-1.es.amazonaws.com/",
      auth: {
        username: "kutayaraz",
        password: "Kutay731!",
      },
    });
  }

  // OpenSearch methods
}
