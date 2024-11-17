import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Patch,
  UseInterceptors,
} from "@nestjs/common";
import { UpdateUserDto } from "../dtos/update-user.dto";
import { UserDto } from "../dtos/user.dto";
import { UserService } from "../services/user.service";
import { Throttle } from "@nestjs/throttler";
import { User } from "src/common/decorators/user.decorator";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";

@Controller("user")
export class UserController {
  constructor(private userService: UserService) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @Get("/profile")
  async getCurrentUserProfile(@User() user: UserDto) {
    return this.userService.findByEmail(user.email);
  }

  @Patch("/profile")
  @UseInterceptors(ClassSerializerInterceptor)
  async updateUser(@UserUuid() userUuid: string, @Body() input: UpdateUserDto) {
    return await this.userService.updateUserProfile(userUuid, input);
  }

  @Throttle({ default: { limit: 1, ttl: 3600000 } })
  @Delete("/profile")
  deleteUser(@UserUuid() userUuid: string) {
    return this.userService.deleteUser(userUuid);
  }
}
