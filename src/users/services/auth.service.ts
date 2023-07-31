import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "../dtos/create-user.dto";
import { JwtService } from "@nestjs/jwt";
import { User } from "src/entities/User.entity";
import { UpdatePasswordDto } from "../dtos/update-password.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { Tokens, JwtPayload } from "../types";
import { ConfigService } from "@nestjs/config";
import { SignUserDto } from "../dtos/sign-user.dto";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private readonly jwtService: JwtService,
    private config: ConfigService,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  public async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  // async refreshToken(user: User) {
  //   const payload = {
  //     username: user.email,
  //     sub: {
  //       id: user.id,
  //     },
  //   };

  //   return {
  //     accessToken: this.jwtService.sign(payload),
  //   };
  // }

  // async validateUser(email: string, password: string) {
  //   const user = await this.usersRepo.findOneBy({ email });

  //   console.log(user);

  //   if (!user) {
  //     throw new BadRequestException("No user found with this e-mail!");
  //   }

  //   if (!(await bcrypt.compare(password, user.password))) {
  //     throw new UnauthorizedException("Invalid credentials");
  //   }

  //   const { password: excludedPassword, ...result } = user;

  //   return result;
  // }

  // async signup(createUserDto: CreateUserDto) {
  //   let user = new User();

  //   if (createUserDto.password !== createUserDto.retypedPassword) {
  //     throw new BadRequestException(["Passwords are not identical"]);
  //   }

  //   const existingUser = await this.usersRepo.findOneBy({
  //     email: createUserDto.email,
  //   });

  //   if (existingUser) {
  //     throw new BadRequestException(["username or email is already taken"]);
  //   }

  //   user.email = createUserDto.email;
  //   user.password = await this.hashPassword(createUserDto.password);
  //   user.firstName = createUserDto.firstName;
  //   user.lastName = createUserDto.lastName;
  //   user.address = createUserDto.address;
  //   user.city = createUserDto.city;

  //   user = this.usersRepo.create(user);

  //   return await this.usersRepo.save(user);
  // }

  // async signin(email: string, password: string) {
  //   const user = await this.validateUser(email, password);

  //   const payload = {
  //     email,
  //     sub: user.id,
  //   };

  //   return {
  //     ...user,
  //     accessToken: this.jwtService.sign(payload),
  //     refreshToken: this.jwtService.sign(payload, { expiresIn: "2d" }),
  //   };
  // }

  async updatePassword(id: number, updatedPasswordData: UpdatePasswordDto) {
    const user = await this.usersService.find(id);

    if (await bcrypt.compare(user.password, updatedPasswordData.oldPassword)) {
      throw new BadRequestException(["Your current password is incorrect"]);
    }

    if (
      updatedPasswordData.newPassword !==
        updatedPasswordData.newPasswordRetyped ||
      updatedPasswordData.oldPassword === updatedPasswordData.newPassword
    ) {
      throw new BadRequestException(
        "Your new password cannot be the same as your current password",
      );
    }

    user.password = await this.hashPassword(updatedPasswordData.newPassword);

    return await this.usersRepo.save(user);
  }

  async remove(id: number) {
    const user = await this.usersService.find(id);

    return this.usersRepo.remove(user);
  }

  async signupLocal(createUserDto: CreateUserDto): Promise<Tokens> {
    let user = new User();

    if (createUserDto.password !== createUserDto.retypedPassword) {
      throw new BadRequestException(["Passwords are not identical"]);
    }

    const existingUser = await this.usersRepo.findOneBy({
      email: createUserDto.email,
    });

    if (existingUser) {
      throw new BadRequestException(["username or email is already taken"]);
    }

    user.email = createUserDto.email;
    user.password = await this.hashPassword(createUserDto.password);
    user.firstName = createUserDto.firstName;
    user.lastName = createUserDto.lastName;
    user.address = createUserDto.address;
    user.city = createUserDto.city;

    user = this.usersRepo.create(user);

    await this.usersRepo.save(user);

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRtHash(user.id, tokens.refresh_token);

    return { ...user, ...tokens };
  }

  async signinLocal(dto: SignUserDto): Promise<Tokens> {
    const user = await this.usersRepo.findOneBy({
      email: dto.email,
    });

    if (!user) throw new ForbiddenException("Access Denied hahaha");

    if (!(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRtHash(user.id, tokens.refresh_token);

    const { password, hashedRt, ...result } = user;

    return { ...result, ...tokens };
  } 

  async logout(userId: number): Promise<boolean> {
    await this.usersRepo.update({ id: userId }, { hashedRt: null });
    return true;
  }

  async refreshTokens(userId: number, rt: string): Promise<Tokens> {
    const user = await this.usersRepo.findOneBy({
      id: userId,
    });
    if (!user || !user.hashedRt) throw new ForbiddenException("Access Denied");

    const rtMatches = await bcrypt.compare(user.hashedRt, rt);
    if (!rtMatches) throw new ForbiddenException("Invalid Credentials");

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRtHash(user.id, tokens.refresh_token);

    return tokens;
  }

  async updateRtHash(userId: number, rt: string): Promise<void> {
    const hashedRt = await bcrypt.hash(rt, 10);
    await this.usersRepo.update({ id: userId }, { hashedRt });
  }

  async getTokens(userId: number, email: string): Promise<Tokens> {
    const jwtPayload: JwtPayload = {
      sub: userId,
      email: email,
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: this.config.get<string>("AT_SECRET"),
        expiresIn: "15m",
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: this.config.get<string>("RT_SECRET"),
        expiresIn: "7d",
      }),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
