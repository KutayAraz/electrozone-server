export interface CategoryInfo {
    subcategory: string;
    topSelling: {
        products: {
            id: any;
            productName: any;
            brand: any;
            thumbnail: any;
            averageRating: any;
            price: any;
            stock: any;
            subcategory: any;
            category: any;
        }[];
        productQuantity: number;
    };
    topWishlisted: {
        products: {
            id: any;
            productName: any;
            brand: any;
            thumbnail: any;
            averageRating: any;
            price: any;
            stock: any;
            subcategory: any;
            category: any;
        }[];
        productQuantity: number;
    };
  }