import { Length, IsString } from "class-validator";

export class UpdatePasswordDto {
  @Length(6, 15)
  oldPassword: string;

  @Length(6, 15)
  @IsString({
    message: "Please enter a valid password between 6 and 15 characters",
  })
  newPassword: string;

  @Length(6, 15)
  @IsString({
    message: "Please enter a valid password between 6 and 15 characters",
  })
  newPasswordRetyped: string;
}
