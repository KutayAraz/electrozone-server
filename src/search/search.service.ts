import { Injectable, Logger } from "@nestjs/common";
import {
  DataSet,
  DeleteInput,
  searchProductByKeyword,
} from "./dtos/search.dto";
import { OpensearchClient } from "nestjs-opensearch";

@Injectable()
export class SearchService {
  constructor(
    private readonly openSearchClient: OpensearchClient,
    private readonly logger: Logger,
  ) {}

  async bulkDataIngestion(input: DataSet): Promise<any> {
    this.logger.log(
      `Inside bulkUpload() Method | Ingesting Bulk data of length ${input.products.length} having index ${input.indexName}`,
    );

    const body = input.products.flatMap((doc) => {
      return [{ index: { _index: input.indexName, _id: doc.id } }, doc];
    });

    try {
      let res = await this.openSearchClient.bulk({ body });
      return res.body;
    } catch (err) {
      this.logger.error(`Exception occurred : ${err})`);
      return {
        httpCode: 500,
        error: err,
      };
    }
  }

  async singleDataIngestion(input: DataSet): Promise<any> {
    this.logger.log(
      `Inside singleUpload() Method | Ingesting single data with index ${input.indexName} `,
    );

    let product = input.products[0];

    try {
      let res = await this.openSearchClient.index({
        id: product.id,
        index: input.indexName,
        body: {
          id: product.id,
          productName: product.productName,
          brand: product.brand,
          description: product.description,
        },
      });
      return res.body;
    } catch (err) {
      this.logger.error(`Exception occurred : ${err})`);
      return {
        httpCode: 500,
        error: err,
      };
    }
  }

  async searchCharaterByKeyword(input: searchProductByKeyword): Promise<any> {
    this.logger.log(`Inside searchByKeyword() Method`);
    let body: any;

    this.logger.log(
      `Searching for Keyword: ${input.keyword} in the index : ${input.indexName} `,
    );
    body = {
      query: {
        multi_match: {
          query: input.keyword,
        },
      },
    };

    try {
      let res = await this.openSearchClient.search({
        index: input.indexName,
        body,
      });
      if (res.body.hits.total.value == 0) {
        return {
          httpCode: 200,
          data: [],
          message: `No Data found based based on Keyword: ${input.keyword}`,
        };
      }
      let result = res.body.hits.hits.map((item) => {
        return {
          _id: item._id,
          data: item._source,
        };
      });

      return {
        httpCode: 200,
        data: result,
        message: `Data fetched successfully based on Keyword: ${input.keyword}`,
      };
    } catch (error) {
      this.logger.error(`Exception occurred while doing : ${error})`);
      return {
        httpCode: 500,
        data: [],
        error: error,
      };
    }
  }
}
