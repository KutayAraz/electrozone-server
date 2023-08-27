import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/entities/User.entity";
import { Repository } from "typeorm";
import { UpdateUserDto } from "../dtos/update-user.dto";

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  async find(id: number) {
    if (!id) {
      throw new BadRequestException(["No user is signed in!"]);
    }
    const user = await this.usersRepo.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(["No user with this email found!"]);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersRepo.findOne({
      where: {
        email,
      },
    });

    if (!user) {
      throw new NotFoundException(["No user with this email found!"]);
    }

    const { password: excludedPassword, hashedRt: excludedRt, ...result } = user;

    return result;
  }

  async update(id: number, updatedUserData: UpdateUserDto) {
    const user = await this.find(id);

    const { password, ...otherFields } = updatedUserData;
    Object.assign(user, otherFields);

    return await this.usersRepo.save(user);
  }
}
