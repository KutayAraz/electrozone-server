import { IsString, IsEmail, Length } from "class-validator";

export class SignUserDto {
  @IsEmail()
  @Length(5, 50)
  email: string;

  @IsString()
  @Length(6, 15)
  password: string;
}
