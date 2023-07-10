import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { CreateUserDto } from "./dtos/create-user.dto";
import { UsersService } from "./services/users.service";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { UpdatePasswordDto } from "./dtos/update-password.dto";
import { UserDto } from "./dtos/user.dto";
import { Serialize } from "src/interceptors/serialize.interceptor";
import { AuthService } from "./services/auth.service";
import { SignUserDto } from "./dtos/sign-user.dto";

@Controller("auth")
@Serialize(UserDto)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}

  @Post("/signup")
  async createNewUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.signup(createUserDto);
  }

  @Post("/signin")
  async signUser(@Body() userCredentials: SignUserDto) {
    return this.authService.signin(
      userCredentials.email,
      userCredentials.password,
    );
  }

  @Get(":id")
  getUser(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.find(id);
  }

  @Patch(":id")
  async updateUser(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: UpdateUserDto,
  ) {
    return await this.usersService.update(id, input);
  }

  @Patch(":id/update-password")
  async updateUserPassword(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: UpdatePasswordDto,
  ) {
    return await this.usersService.updatePassword(id, input);
  }

  @Delete(":id")
  removeUser(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
