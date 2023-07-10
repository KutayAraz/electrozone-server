import { BadRequestException, Injectable } from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "../dtos/create-user.dto";
import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt);

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async signup(input: CreateUserDto) {
    const salt = randomBytes(8).toString("hex");

    const hash = (await scrypt(input.password, salt, 32)) as Buffer;

    const result = salt + "." + hash.toString("hex");

    return await this.usersService.create({
      ...input,
      password: result,
      retypedPassword: result,
    });
  }

  async signin(email: string, password: string) {
    const user = this.usersService.findByEmail(email);

    const [salt, storedHash] = (await user).password.split(".");

    const hash = (await scrypt(password, salt, 32)) as Buffer;

    if (storedHash !== hash.toString("hex")) {
      throw new BadRequestException("Password is wrong");
    }

    return user;
  }
}
