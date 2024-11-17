import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Res,
  Req,
} from "@nestjs/common";
import { Response, Request } from "express";
import { CreateUserDto } from "../dtos/create-user.dto";
import { ChangePasswordDto } from "../dtos/update-password.dto";
import { AuthService } from "../services/auth.service";
import { SignUserDto } from "../dtos/sign-user.dto";
import { Throttle } from "@nestjs/throttler";
import { Public } from "src/common/decorators/public.decorator";
import { AtGuard } from "src/common/guards/at.guard";
import { RtGuard } from "src/common/guards/rt.guard";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { RefreshTokenUserUuid } from "src/common/decorators/user-uuid-from-cookie.decorator";

@Controller("auth")
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() dto: CreateUserDto) {
    return this.authService.signUp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 3600000 } })
  @Post("signin")
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() dto: SignUserDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.signIn(dto, res);
    return user;
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 3600000 } })
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const refreshToken = req.cookies?.refresh_token;

    const result = await this.authService.logout(refreshToken, res);

    res.cookie("refresh_token", "", { httpOnly: true, expires: new Date(0) });
    res.send({ success: result });
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Patch("/update-password")
  async updateUserPassword(@UserUuid() userUuid: string, @Body() input: ChangePasswordDto) {
    return await this.authService.changePassword(userUuid, input);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 3600000 } })
  @UseGuards(RtGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @RefreshTokenUserUuid() userUuid: string,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    const refreshToken = request.cookies?.refresh_token;

    const tokens = await this.authService.refreshTokens(userUuid, refreshToken, res);

    res.json({
      access_token: tokens.access_token,
    });
  }
}
