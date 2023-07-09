import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/entities/User.entity";
import { Repository } from "typeorm";
import { CreateUserDto } from "./dtos/create-user.dto";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { UpdatePasswordDto } from "./dtos/update-password.dto";

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  async createUser(createUserDto: CreateUserDto) {
    if (createUserDto.password !== createUserDto.retypedPassword) {
      throw new BadRequestException(["Passwords do not match"]);
    }

    const existingUser = this.usersRepo.find({
      where: [
        {
          email: createUserDto.email,
        },
      ],
    });

    if (existingUser) {
      throw new BadRequestException(["A user with this email already exists"]);
    }

    const user = this.usersRepo.create(createUserDto);
    return await this.usersRepo.save(user);
  }

  async find(id: number) {
    const user = await this.usersRepo.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(["No user with this email found!"]);
    }

    return user;
  }

  async update(id: number, updatedUserData: UpdateUserDto) {
    const user = await this.find(id);

    const { password, ...otherFields } = updatedUserData;
    Object.assign(user, otherFields);

    return await this.usersRepo.save(user);
  }

  async updatePassword(id: number, updatedPasswordData: UpdatePasswordDto) {
    const user = await this.find(id);

    if (user.password !== updatedPasswordData.oldPassword) {
      throw new BadRequestException(["Your current password is incorrect"]);
    }

    if (
      updatedPasswordData.newPassword !==
        updatedPasswordData.newPasswordRetyped ||
      updatedPasswordData.oldPassword === updatedPasswordData.newPassword
    ) {
      throw new BadRequestException(
        "Your new password cannot be the same as your current password",
      );
    }

    user.password = updatedPasswordData.newPassword;

    return await this.usersRepo.save(user);
  }

  async remove(id: number) {
    const user = await this.find(id);

    return this.usersRepo.remove(user);
  }
}
