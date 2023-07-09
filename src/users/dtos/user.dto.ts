import { Expose } from "class-transformer";
import { IsString, IsEmail, Length } from "class-validator";
import { PrimaryGeneratedColumn } from "typeorm";

export class UserDto {
  @PrimaryGeneratedColumn()
  @Expose()
  id: number;

  @IsEmail()
  @Length(5, 50)
  @Expose()
  email: string;

  @IsString({ message: "Please enter a valid name" })
  @Length(2, 50)
  @Expose()
  firstName: string;

  @IsString({ message: "Please enter a valid name" })
  @Length(2, 50)
  @Expose()
  lastName: string;

  @IsString({ message: "Please enter a valid address" })
  @Length(3, 150)
  @Expose()
  address: string;

  @IsString({ message: "Please enter a valid city" })
  @Length(2, 50)
  @Expose()
  city: string;
}
