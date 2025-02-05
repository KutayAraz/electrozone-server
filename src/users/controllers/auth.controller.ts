import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { Public } from "src/common/decorators/public.decorator";
import { RefreshTokenUserUuid } from "src/common/decorators/refresh-token-user-uuid";
import { UserUuid } from "src/common/decorators/user-uuid.decorator";
import { RtGuard } from "src/common/guards/rt.guard";
import { CreateUserDto } from "../dtos/create-user.dto";
import { SignUserDto } from "../dtos/sign-user.dto";
import { ChangePasswordDto } from "../dtos/update-password.dto";
import { AuthService } from "../services/auth.service";

@Controller("auth")
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.register(dto, res);
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 3600000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: SignUserDto, @Res({ passthrough: true }) res: Response) {
    return await this.authService.login(dto, res);
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 3600000 } })
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const refreshToken = req.cookies?.refresh_token;
    const result = await this.authService.logout(refreshToken, res);
    res.send({ success: result });
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Patch("/change-password")
  async changePassword(@UserUuid() userUuid: string, @Body() input: ChangePasswordDto) {
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
    await this.authService.refreshTokens(userUuid, refreshToken, res);
    res.json({ success: true });
  }
}
