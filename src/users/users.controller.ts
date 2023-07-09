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
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { UpdatePasswordDto } from "./dtos/update-password.dto";
import { UserDto } from "./dtos/user.dto";
import { Serialize } from "src/interceptors/serialize.interceptor";

@Controller("auth")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  async createNewUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Serialize(UserDto)
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
