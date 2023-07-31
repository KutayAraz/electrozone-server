import { IsDate, IsNumber, IsString, Length, Max, Min, max, maxDate } from "class-validator";

export class CreateReviewDto {
  @IsDate()
  reviewDate: Date = new Date();

  @IsNumber()
  @Min(0)
  @Max(5)
  rating: number;

  @IsString()
  @Length(0, 255)
  comment: string;
}
