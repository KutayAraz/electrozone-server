import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Patch,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { UpdateUserDto } from "../dtos/update-user.dto";
import { AuthUtilityService } from "../services/auth-utility.service";
import { UserService } from "../services/user.service";

@Controller("user")
export class UserController {
  constructor(
    private userService: UserService,
    private authUtilityService: AuthUtilityService,
  ) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @Get("/profile")
  async getCurrentUserProfile(@UserUuid() userUuid: string) {
    return this.userService.getProfile(userUuid);
  }

  @Patch("/profile")
  @UseInterceptors(ClassSerializerInterceptor)
  async updateUser(@UserUuid() userUuid: string, @Body() input: UpdateUserDto) {
    return await this.userService.updateUserProfile(userUuid, input);
  }

  @Throttle({ default: { limit: 1, ttl: 3600000 } })
  @Delete("/profile")
  async deleteUser(@UserUuid() userUuid: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.userService.deleteUser(userUuid);

    this.authUtilityService.clearAuthCookies(res);

    return result;
  }
}
