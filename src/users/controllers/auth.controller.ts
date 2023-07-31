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
} from "@nestjs/common";
import { CreateUserDto } from "../dtos/create-user.dto";
import { UpdatePasswordDto } from "../dtos/update-password.dto";
import { UserDto } from "../dtos/user.dto";
import { AuthService } from "../services/auth.service";
import { SignUserDto } from "../dtos/sign-user.dto";
import {
  Public,
  GetCurrentUserId,
  GetCurrentUser,
} from "../../common/decorators";
import { Tokens } from "../types";
import { AtGuard, RtGuard } from "src/common/guards";

@Controller("auth")
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("local/signup")
  @HttpCode(HttpStatus.CREATED)
  signupLocal(@Body() dto: CreateUserDto) {
    return this.authService.signupLocal(dto);
  }

  @Public()
  @Post("local/signin")
  @HttpCode(HttpStatus.OK)
  signinLocal(@Body() dto: SignUserDto): Promise<Tokens> {
    return this.authService.signinLocal(dto);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@GetCurrentUserId() userId: number): Promise<boolean> {
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
  refreshTokens(
    @GetCurrentUserId() userId: number,
    @GetCurrentUser("refreshToken") refreshToken: string,
  ): Promise<Tokens> {
    return this.authService.refreshTokens(userId, refreshToken);
  }
}

// @Post("/signup")
// async createNewUser(@Body() createUserDto: CreateUserDto) {
//   return await this.authService.signup(createUserDto);
// }

// @UseGuards(AuthGuardLocal)
// @Post("/signin")
// async signUser(@Body() userCredentials: SignUserDto) {
//   return await this.authService.signin(
//     userCredentials.email,
//     userCredentials.password,
//   );
// }

// @UseGuards(RefreshJwtGuard)
// @Post("refresh")
// async refreshToken(@Request() req) {
//   return this.authService.refreshToken(req.user);
// }
