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
import { AtGuard, RtGuard } from "src/common/guards";
import { Throttle } from "@nestjs/throttler";

@Controller("auth")
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private authService: AuthService) { }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signupLocal(@Body() dto: CreateUserDto) {
    return this.authService.signupLocal(dto);
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 3600000 } })
  @Post("signin")
  @HttpCode(HttpStatus.OK)
  async signinLocal(
    @Body() dto: SignUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.signinLocal(dto, res);
    return user;
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 3600000 } })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const refreshToken = req.cookies?.refresh_token;
    try {
      const result = await this.authService.logout(refreshToken, res);

      res.cookie('refresh_token', '', { httpOnly: true, expires: new Date(0) });
      res.send({ success: result });
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).send({ success: false, message: error.message });
    }
  }

  @UseGuards(AtGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Patch("/update-password")
  async updateUserPassword(
    @GetCurrentUserId() id: number,
    @Body() input: UpdatePasswordDto,
  ) {
    return await this.authService.updatePassword(id, input);
  }

  @UseGuards(AtGuard)
  @Throttle({ default: { limit: 1, ttl: 3600000 } })
  @Delete("/profile")
  removeUser(@GetCurrentUser() user: UserDto) {
    return this.authService.remove(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  @UseGuards(RtGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @GetCurrentUserIdFromCookies() userId: number,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) {
      throw new BadRequestException("Refresh token missing in cookie.");
    }

    const tokens = await this.authService.refreshTokens(userId, refreshToken, res);

    res.json({
      access_token: tokens.access_token,
    });
  }

}
