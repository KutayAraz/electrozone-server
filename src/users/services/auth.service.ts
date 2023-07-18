import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "../dtos/create-user.dto";
import { JwtService } from "@nestjs/jwt";
import { User } from "src/entities/User.entity";
import { UpdatePasswordDto } from "../dtos/update-password.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  // public getTokenForUser(user: User): string {
  //   return this.jwtService.sign({
  //     email: user.email,
  //     sub: user.id,
  //   });
  // }

  public async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  async refreshToken(user: User) {
    const payload = {
      username: user.email,
      sub: {
        id: user.id,
      },
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException("No user found with this e-mail!");
    }

    if (!(await bcrypt.compare(password, user.password))) {
      throw new BadRequestException("Entered password is incorrect");
    }

    const { password: excludedPassword, ...result } = user;

    return result;
  }

  async signup(createUserDto: CreateUserDto) {
    let user = new User();

    if (createUserDto.password !== createUserDto.retypedPassword) {
      throw new BadRequestException(["Passwords are not identical"]);
    }

    const existingUser = await this.usersRepo.findOneBy({
      email: createUserDto.email,
    });

    if (existingUser) {
      throw new BadRequestException(["username or email is already taken"]);
    }

    user.email = createUserDto.email;
    user.password = await this.hashPassword(createUserDto.password);
    user.firstName = createUserDto.firstName;
    user.lastName = createUserDto.lastName;
    user.address = createUserDto.address;
    user.city = createUserDto.city;

    user = this.usersRepo.create(user);

    return await this.usersRepo.save(user);
  }

  async signin(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const payload = {
      email,
      sub: user.id,
    };

    return {
      ...user,
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: "2d" }),
    };
  }

  async updatePassword(id: number, updatedPasswordData: UpdatePasswordDto) {
    const user = await this.usersService.find(id);

    if (await bcrypt.compare(user.password, updatedPasswordData.oldPassword)) {
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

    user.password = await this.hashPassword(updatedPasswordData.newPassword);

    return await this.usersRepo.save(user);
  }

  async remove(id: number) {
    const user = await this.usersService.find(id);

    return this.usersRepo.remove(user);
  }
}
