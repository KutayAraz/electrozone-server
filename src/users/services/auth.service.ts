import { HttpStatus, Injectable } from "@nestjs/common";
import { CreateUserDto } from "../dtos/create-user.dto";
import { User } from "src/entities/User.entity";
import { ChangePasswordDto } from "../dtos/update-password.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { Tokens } from "../types";
import { SignUserDto } from "../dtos/sign-user.dto";
import { Response } from "express";
import { Cart } from "src/entities/Cart.entity";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { AuthUtilityService } from "./auth-utility.service";
import { UserService } from "./user.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly authUtilityService: AuthUtilityService,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) { }

  async changePassword(uuid: string, updatedPasswordData: ChangePasswordDto): Promise<User> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await this.userService.findByUuid(uuid);

      if (await bcrypt.compare(updatedPasswordData.oldPassword, user.password)) {
        throw new AppError(ErrorType.INVALID_CURRENT_PASSWORD, 'Current password is incorrect', HttpStatus.UNAUTHORIZED);
      }

      if (
        updatedPasswordData.newPassword !== updatedPasswordData.newPasswordRetyped ||
        updatedPasswordData.oldPassword === updatedPasswordData.newPassword
      ) {
        throw new AppError(ErrorType.INVALID_NEW_PASSWORD, 'New password is invalid')
      }

      if (!this.authUtilityService.isPasswordStrong(updatedPasswordData.newPassword)) {
        throw new AppError(ErrorType.INVALID_NEW_PASSWORD, 'Password is not strong enough');
      }

      user.password = await this.authUtilityService.hashPassword(updatedPasswordData.newPassword);

      return await transactionalEntityManager.save(User, user);
    });
  }

  async signUp(createUserDto: CreateUserDto): Promise<Tokens & Partial<User>> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      if (createUserDto.password !== createUserDto.retypedPassword) {
        throw new AppError(ErrorType.PASSWORD_MISMATCH, 'Your new password does not match');
      }

      const existingUser = await transactionalEntityManager.findOne(User, { where: { email: createUserDto.email } });
      if (existingUser) {
        throw new AppError(ErrorType.USER_ALREADY_EXISTS, 'A user with this e-mail already exists', HttpStatus.CONFLICT);
      }

      const user = transactionalEntityManager.create(User, {
        ...createUserDto,
        password: await this.authUtilityService.hashPassword(createUserDto.password),
        firstName: this.authUtilityService.capitalizeFirstLetterOfEachWord(createUserDto.firstName),
        lastName: this.authUtilityService.capitalizeFirstLetterOfEachWord(createUserDto.lastName),
        address: this.authUtilityService.capitalizeFirstLetterOfEachWord(createUserDto.address),
        city: this.authUtilityService.capitalizeFirstLetterOfEachWord(createUserDto.city),
      });

      await transactionalEntityManager.save(user);

      // Create an empty cart for the new user
      const cart = transactionalEntityManager.create(Cart, { user, totalQuantity: 0 });
      await transactionalEntityManager.save(cart);

      const tokens = await this.authUtilityService.getTokens(user);
      await this.authUtilityService.updateRtHash(user.uuid, tokens.refresh_token, transactionalEntityManager);

      const { password, hashedRt, ...result } = user;
      return { ...result, ...tokens };
    });
  }

  async signIn(dto: SignUserDto, res: Response): Promise<Partial<User> & { access_token: string; cartItemCount: number }> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await transactionalEntityManager.findOne(User, { where: { email: dto.email } });

      if (!user) throw new AppError(ErrorType.USER_NOT_FOUND, 'A user with this e-mail does not exist', HttpStatus.NOT_FOUND);

      if (!(await bcrypt.compare(dto.password, user.password))) {
        throw new AppError(ErrorType.INVALID_CREDENTIALS, 'Your credentials are invalid', HttpStatus.UNAUTHORIZED);
      }

      const tokens = await this.authUtilityService.getTokens(user);
      await this.authUtilityService.updateRtHash(user.uuid, tokens.refresh_token, transactionalEntityManager);
      this.authUtilityService.setRefreshTokenCookie(res, tokens.refresh_token);

      const cart = await transactionalEntityManager.findOne(Cart, {
        where: { user: { id: user.id } },
      });

      const cartItemCount = cart ? cart.totalQuantity : 0;

      const { password, hashedRt, id, uuid, ...result } = user;

      return {
        ...result,
        access_token: tokens.access_token,
        cartItemCount,
      };
    });
  }

  async logout(uuid: string, res: Response): Promise<boolean> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      await transactionalEntityManager.update(User, { uuid }, { hashedRt: null });
      res.clearCookie('refresh_token');
      return true;
    });
  }

  async refreshTokens(uuid: string, rt: string, res: Response): Promise<Tokens> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await transactionalEntityManager.findOne(User, { where: { uuid } });

      if (!user || !user.hashedRt) throw new AppError(ErrorType.ACCESS_DENIED, 'Access denied', HttpStatus.UNAUTHORIZED);

      const rtMatches = await bcrypt.compare(rt, user.hashedRt);
      if (!rtMatches) throw new AppError(ErrorType.ACCESS_DENIED, 'Access denied', HttpStatus.UNAUTHORIZED);

      const tokens = await this.authUtilityService.getTokens(user);
      await this.authUtilityService.updateRtHash(user.uuid, tokens.refresh_token, transactionalEntityManager);

      this.authUtilityService.setRefreshTokenCookie(res, tokens.refresh_token);

      return tokens;

    });
  }
}