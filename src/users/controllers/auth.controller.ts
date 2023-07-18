import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Patch,
  Post,
  Request,
  SerializeOptions,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CreateUserDto } from "../dtos/create-user.dto";
import { UpdatePasswordDto } from "../dtos/update-password.dto";
import { UserDto } from "../dtos/user.dto";
import { AuthService } from "../services/auth.service";
import { SignUserDto } from "../dtos/sign-user.dto";
import { AuthGuardLocal } from "../guards/local-auth.guard";
import { CurrentUser } from "../decorators/current-user.decorator";
import { JwtGuard } from "../guards/jwt-auth.guard";
import { RefreshJwtGuard } from "../guards/refresh-jwt-auth.guard";

@Controller("auth")
@SerializeOptions({ strategy: "excludeAll" })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("/signup")
  @UseInterceptors(ClassSerializerInterceptor)
  async createNewUser(@Body() createUserDto: CreateUserDto) {
    return await this.authService.signup(createUserDto);
  }

  @UseGuards(AuthGuardLocal)
  @Post("/signin")
  async signUser(@Body() userCredentials: SignUserDto) {
    return await this.authService.signin(
      userCredentials.email,
      userCredentials.password,
    );
  }

  @UseGuards(JwtGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @Patch("/update-password")
  async updateUserPassword(
    @CurrentUser() user: UserDto,
    @Body() input: UpdatePasswordDto,
  ) {
    return await this.authService.updatePassword(user.id, input);
  }

  @UseGuards(JwtGuard)
  @Delete("/profile")
  removeUser(@CurrentUser() user: UserDto) {
    return this.authService.remove(user.id);
  }

  @UseGuards(RefreshJwtGuard)
  @Post("refresh")
  async refreshToken(@Request() req) {
    return this.authService.refreshToken(req.user);
  }
}
