import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Patch,
  SerializeOptions,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { UsersService } from "../services/users.service";
import { UpdateUserDto } from "../dtos/update-user.dto";
import { CurrentUser } from "../decorators/current-user.decorator";
import { User } from "src/entities/User.entity";
import { JwtGuard } from "../guards/jwt-auth.guard";
import { UserDto } from "../dtos/user.dto";

@Controller("user")
@SerializeOptions({ strategy: "excludeAll" })
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @Get("/profile")
  async getCurrentUserProfile(@CurrentUser() user: UserDto) {
    return user;
  }

  @UseGuards(JwtGuard)
  @Patch("/profile")
  @UseInterceptors(ClassSerializerInterceptor)
  async updateUser(@CurrentUser() user: UserDto, @Body() input: UpdateUserDto) {
    return await this.usersService.update(user.id, input);
  }
}
