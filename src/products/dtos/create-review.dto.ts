import {
  IsNumber,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateReviewDto {
  @IsNumber()
  @Min(0)
  @Max(5)
  rating: number;

  @IsString()
  @Length(0, 255)
  comment: string;
}
