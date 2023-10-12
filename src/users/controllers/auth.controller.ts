import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { Response, Request } from "express";
import { CreateUserDto } from "../dtos/create-user.dto";
import { UpdatePasswordDto } from "../dtos/update-password.dto";
import { UserDto } from "../dtos/user.dto";
import { AuthService } from "../services/auth.service";
import { SignUserDto } from "../dtos/sign-user.dto";
import {
  Public,
  GetCurrentUserId,
  GetCurrentUser,
  GetCurrentUserIdFromCookies,
} from "../../common/decorators";
import { Tokens } from "../types";
import { AtGuard, RtGuard } from "src/common/guards";

@Controller("auth")
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signupLocal(@Body() dto: CreateUserDto) {
    return this.authService.signupLocal(dto);
  }

  @Public()
  @Post("signin")
  @HttpCode(HttpStatus.OK)
  async signinLocal(
    @Body() dto: SignUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.signinLocal(dto);

    res.cookie("refresh_token", user.refresh_token, {
      expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days in milliseconds
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    return user;
  }

  @Public()
  @Post("logout")
  @UseGuards(RtGuard)
  @HttpCode(HttpStatus.OK)
  logout(@GetCurrentUserIdFromCookies() userId: number): Promise<boolean> {
    return this.authService.logout(userId);
  }

  @UseGuards(AtGuard)
  @Patch("/update-password")
  async updateUserPassword(
    @GetCurrentUserId() id: number,
    @Body() input: UpdatePasswordDto,
  ) {
    return await this.authService.updatePassword(id, input);
  }

  @UseGuards(AtGuard)
  @Delete("/profile")
  removeUser(@GetCurrentUser() user: UserDto) {
    return this.authService.remove(user.id);
  }

  @Public()
  @UseGuards(RtGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @GetCurrentUserIdFromCookies() userId: number,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    const refreshToken = request.cookies?.refreshToken;
    if (!refreshToken) {
      throw new BadRequestException("Refresh token missing in cookie.");
    }

    const tokens = await this.authService.refreshTokens(userId, refreshToken);
    res.cookie("refreshToken", tokens.refresh_token, {
      httpOnly: true,
      expires: new Date(new Date().getTime() + 48 * 60 * 60 * 1000),
      sameSite: "strict",
      secure: true
    });

    res.json({
      access_token: tokens.access_token,
    });
  }
}
