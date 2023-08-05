import { Module, DynamicModule } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import { SearchService } from "./search.service";

@Module({})
export class SearchModule {
  static register(url): DynamicModule {
    return {
      module: SearchModule,
      providers: [
        SearchService,
        {
          provide: "Open_Search_JS_Client",
          useValue: {
            instance: new Client({
              node: "https://localhost:9200",
              ssl: {
                rejectUnauthorized: false,
              },
            }),
          },
        },
      ],
      exports: [SearchService],
    };
  }
}