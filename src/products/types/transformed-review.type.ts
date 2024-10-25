export interface TransformedReview {
    id: number;
    reviewDate: Date;
    rating: string;
    comment: string;
    user: {
        firstName: string;
        lastName: string;
    };
}