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
import { Response } from "express";
import { Cart } from "src/entities/Cart.entity";
import * as jwt from "jsonwebtoken";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private readonly jwtService: JwtService,
    private config: ConfigService,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Cart) private cartsRepo: Repository<Cart>,
  ) {}

  public async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  private capitalizeFirstLetterOfEachWord(input: string): string {
    const words = input.split(" ");

    const capitalizedWords = words.map((word) => {
      const lowercaseWord = word.toLocaleLowerCase("tr-TR");
      const capitalizedWord =
        lowercaseWord.charAt(0).toLocaleUpperCase("tr-TR") +
        lowercaseWord.slice(1);
      return capitalizedWord;
    });

    return capitalizedWords.join(" ");
  }

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
    user.firstName = this.capitalizeFirstLetterOfEachWord(
      createUserDto.firstName,
    );
    user.lastName = this.capitalizeFirstLetterOfEachWord(
      createUserDto.lastName,
    );
    user.address = this.capitalizeFirstLetterOfEachWord(createUserDto.address);
    user.city = this.capitalizeFirstLetterOfEachWord(createUserDto.city);

    user = this.usersRepo.create(user);

    await this.usersRepo.save(user);

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRtHash(user.id, tokens.refresh_token);

    return { ...user, ...tokens };
  }

  async signinLocal(dto: SignUserDto, res: Response): Promise<any> {
    const user = await this.usersRepo.findOneBy({
      email: dto.email,
    });

    if (!user) throw new ForbiddenException("Access Denied");

    if (!(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRtHash(user.id, tokens.refresh_token);
    this.setRefreshTokenCookie(res, tokens.refresh_token);

    // Fetch user's cart to get the item count
    const cart = await this.cartsRepo.findOne({
      where: { user: { id: user.id } },
    });

    const cartItemCount = cart ? cart.totalQuantity : 0; // Fetch total quantity

    const { password, hashedRt, ...result } = user;

    return {
      ...result,
      access_token: tokens.access_token, // Only return access token
      cartItemCount, // Include cart item count in the response
    };
  }

// AuthService
async logout(refreshToken: string, res: Response): Promise<boolean> {
  const userId = this.extractUserIdFromToken(refreshToken);
  if (!userId) {
    throw new BadRequestException("Invalid token");
  }

  try {
    await this.usersRepo.update({ id: userId }, { hashedRt: null });
    
    // Set the cookie to an expired date to remove it in the controller
    return true;
  } catch (error: unknown) {
    console.log(error);
    throw new BadRequestException("There was an error trying to log out");
  }
}

private extractUserIdFromToken(token: string): any {
  try {
    const decoded = jwt.decode(token);
    return decoded?.sub;
  } catch (error) {
    return null;
  }
}


  async refreshTokens(
    userId: number,
    rt: string,
    res: Response,
  ): Promise<Tokens> {
    const user = await this.usersRepo.findOneBy({
      id: userId,
    });

    if (!user || !user.hashedRt) throw new ForbiddenException("Access Denied");

    const rtMatches = await bcrypt.compare(rt, user.hashedRt);
    if (!rtMatches) throw new ForbiddenException("Invalid Credentials");

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRtHash(user.id, tokens.refresh_token);

    this.setRefreshTokenCookie(res, tokens.refresh_token);

    return tokens;
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie("refresh_token", token, {
      httpOnly: true,
      expires: new Date(new Date().getTime() + 120 * 60 * 60 * 1000),
      sameSite: "none",
      secure: true,
    });
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
        expiresIn: "5d",
      }),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
