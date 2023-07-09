import { IsString, IsEmail, Length } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @Length(5, 50)
  email: string;

  @IsString()
  @Length(6, 15)
  password: string;

  @IsString()
  @Length(6, 15)
  retypedPassword: string;

  @IsString({ message: 'Please enter a valid name' })
  @Length(2, 50)
  firstName: string;

  @IsString({ message: 'Please enter a valid name' })
  @Length(2, 50)
  lastName: string;

  @IsString({ message: 'Please enter a valid address' })
  @Length(3, 150)
  address: string;

  @IsString({ message: 'Please enter a valid city' })
  @Length(2, 50)
  city: string;
}
