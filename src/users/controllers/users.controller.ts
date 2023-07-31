import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Patch,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { UsersService } from "../services/users.service";
import { UpdateUserDto } from "../dtos/update-user.dto";
import { UserDto } from "../dtos/user.dto";
import { AtGuard } from "src/common/guards";
import { GetCurrentUser, GetCurrentUserId } from "src/common/decorators";

@Controller("user")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @UseGuards(AtGuard)  
  @Get("/profile")
  async getCurrentUserProfile(@GetCurrentUser() user: UserDto) {
    return user;
  }

  @UseGuards(AtGuard)
  @Patch("/profile")
  @UseInterceptors(ClassSerializerInterceptor)
  async updateUser(@GetCurrentUserId() id: number, @Body() input: UpdateUserDto) {
    return await this.usersService.update(id, input);
  }
}
