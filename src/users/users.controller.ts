import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Session,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CreateUserDto } from "./dtos/create-user.dto";
import { UsersService } from "./services/users.service";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { UpdatePasswordDto } from "./dtos/update-password.dto";
import { UserDto } from "./dtos/user.dto";
import { Serialize } from "src/interceptors/serialize.interceptor";
import { AuthService } from "./services/auth.service";
import { SignUserDto } from "./dtos/sign-user.dto";
import { CurrentUser } from "./decorators/current-user.decorator";
import { CurrentUserInterceptor } from "./interceptors/current-user.interceptor";
import { User } from "src/entities/User.entity";
import { AuthGuard } from "src/guards/auth.guard";

@Controller("auth")
@Serialize(UserDto)
@UseInterceptors(CurrentUserInterceptor)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}

  @Post("/signup")
  async createNewUser(
    @Body() createUserDto: CreateUserDto,
    @Session() session: any,
  ) {
    const user = await this.authService.signup(createUserDto);
    session.userId = user.id;
  }

  @Post("/signin")
  async signUser(
    @Body() userCredentials: SignUserDto,
    @Session() session: any,
  ) {
    const user = await this.authService.signin(
      userCredentials.email,
      userCredentials.password,
    );
    session.userId = user.id;
    return user;
  }

  @Get("/user")
  @UseGuards(AuthGuard)
  who(@CurrentUser() user: User) {
    return user;
  }

  @Get("/current-user")
  async getSignedUser(@Session() session: any) {
    return this.usersService.find(session.userId);
  }

  @Post("/signout")
  async signOut(@Session() session: any) {
    session.userId = null;
  }

  @Get(":id")
  getUser(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.find(id);
  }

  @Patch(":id")
  async updateUser(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: UpdateUserDto,
  ) {
    return await this.usersService.update(id, input);
  }

  @Patch(":id/update-password")
  async updateUserPassword(
    @Param("id", ParseIntPipe) id: number,
    @Body() input: UpdatePasswordDto,
  ) {
    return await this.usersService.updatePassword(id, input);
  }

  @Delete(":id")
  removeUser(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
