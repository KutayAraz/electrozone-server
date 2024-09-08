export interface TransformedReview {
    id: number;
    reviewDate: Date;
    rating: number;
    comment: string;
    user: {
        firstName: string;
        lastName: string;
    };
}