export class DataSet {
    indexName: string;
    products: Products[];
  }
  
  export class Products {
    id: string;
    productName: string;
    brand: string;
    description: string;
  }
  
  export class DeleteInput {
    indexName: string;
    id?: string;
  }
  
  export class searchProductByKeyword {
    indexName: string;
    keyword: string;
  }