import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Response } from "express";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { User } from "src/entities/User.entity";
import { Repository } from "typeorm";
import { CreateUserDto } from "../dtos/create-user.dto";
import { SignUserDto } from "../dtos/sign-user.dto";
import { ChangePasswordDto } from "../dtos/update-password.dto";
import { Tokens } from "../types/tokens.type";
import { UserRole } from "../types/user-role.enum";
import { AuthUtilityService } from "./auth-utility.service";
import { UserService } from "./user.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly authUtilityService: AuthUtilityService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  async changePassword(userUuid: string, updatedPasswordData: ChangePasswordDto): Promise<User> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await this.userService.findByUuid(userUuid);

      // Check if the old password is correct
      if (!(await bcrypt.compare(updatedPasswordData.oldPassword, user.password))) {
        throw new AppError(
          ErrorType.INVALID_CURRENT_PASSWORD,
          "Current password is incorrect",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate new password
      if (
        updatedPasswordData.newPassword !== updatedPasswordData.newPasswordRetyped ||
        updatedPasswordData.oldPassword === updatedPasswordData.newPassword
      ) {
        throw new AppError(ErrorType.INVALID_NEW_PASSWORD, "New password is invalid");
      }

      if (!this.authUtilityService.isPasswordStrong(updatedPasswordData.newPassword)) {
        throw new AppError(ErrorType.INVALID_NEW_PASSWORD, "Password is not strong enough");
      }

      // Hash and save new password
      user.password = await this.authUtilityService.hashPassword(updatedPasswordData.newPassword);

      return await transactionalEntityManager.save(User, user);
    });
  }

  async register(createUserDto: CreateUserDto, res: Response): Promise<Tokens & Partial<User>> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      // Validate password match
      if (createUserDto.password !== createUserDto.retypedPassword) {
        throw new AppError(ErrorType.PASSWORD_MISMATCH, "Your new password does not match");
      }

      if (!this.authUtilityService.isPasswordStrong(createUserDto.password)) {
        throw new AppError(ErrorType.INVALID_NEW_PASSWORD, "Password is not strong enough");
      }

      // Check if user already exists
      const existingUser = await transactionalEntityManager.findOne(User, {
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        throw new AppError(
          ErrorType.USER_ALREADY_EXISTS,
          "A user with this e-mail already exists",
          HttpStatus.CONFLICT,
        );
      }

      // Create new user with capitalized name fields
      const user = transactionalEntityManager.create(User, {
        ...createUserDto,
        role: UserRole.CUSTOMER,
        password: await this.authUtilityService.hashPassword(createUserDto.password),
        firstName: this.authUtilityService.capitalizeFirstLetterOfEachWord(createUserDto.firstName),
        lastName: this.authUtilityService.capitalizeFirstLetterOfEachWord(createUserDto.lastName),
        address: this.authUtilityService.capitalizeFirstLetterOfEachWord(createUserDto.address),
        city: this.authUtilityService.capitalizeFirstLetterOfEachWord(createUserDto.city),
      });

      await transactionalEntityManager.save(user);

      // Generate tokens and update refresh token hash
      const tokens = await this.authUtilityService.getTokens(user);
      await this.authUtilityService.updateRtHash(
        user.uuid,
        tokens.refresh_token,
        transactionalEntityManager,
      );

      // Set both cookies
      this.authUtilityService.setRefreshTokenCookie(res, tokens.refresh_token);
      this.authUtilityService.setAccessTokenCookie(res, tokens.access_token);

      // Remove sensitive data before returning user info
      const { password, hashedRt, role, ...result } = user;
      return { ...result, ...tokens };
    });
  }

  async login(dto: SignUserDto, res: Response): Promise<Partial<User>> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await transactionalEntityManager.findOne(User, { where: { email: dto.email } });

      if (!user)
        throw new AppError(
          ErrorType.USER_NOT_FOUND,
          "A user with this e-mail does not exist",
          HttpStatus.NOT_FOUND,
        );

      // Validate password
      if (!(await bcrypt.compare(dto.password, user.password))) {
        throw new AppError(
          ErrorType.INVALID_CREDENTIALS,
          "Your credentials are invalid",
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Generate tokens and update refresh token hash
      const tokens = await this.authUtilityService.getTokens(user);
      await this.authUtilityService.updateRtHash(
        user.uuid,
        tokens.refresh_token,
        transactionalEntityManager,
      );

      // Set both cookies
      this.authUtilityService.setRefreshTokenCookie(res, tokens.refresh_token);
      this.authUtilityService.setAccessTokenCookie(res, tokens.access_token);

      // Remove sensitive data before returning user info
      const { password, hashedRt, id, uuid, role, ...result } = user;

      return {
        ...result,
      };
    });
  }

  async logout(userUuid: string, res: Response): Promise<boolean> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      // Clear the refresh token hash in the database
      await transactionalEntityManager.update(User, { uuid: userUuid }, { hashedRt: null });
      // Clear both cookies
      this.authUtilityService.clearAuthCookies(res);
      return true;
    });
  }

  async refreshTokens(userUuid: string, rt: string, res: Response): Promise<void> {
    return this.usersRepo.manager.transaction(async transactionalEntityManager => {
      const user = await transactionalEntityManager.findOne(User, { where: { uuid: userUuid } });

      if (!user || !user.hashedRt)
        throw new AppError(ErrorType.ACCESS_DENIED, "Access denied", HttpStatus.UNAUTHORIZED);

      // Validate the provided refresh token
      const rtMatches = await bcrypt.compare(rt, user.hashedRt);
      if (!rtMatches)
        throw new AppError(ErrorType.ACCESS_DENIED, "Access denied", HttpStatus.UNAUTHORIZED);

      // Generate new tokens
      const tokens = await this.authUtilityService.getTokens(user);
      await this.authUtilityService.updateRtHash(
        user.uuid,
        tokens.refresh_token,
        transactionalEntityManager,
      );

      // Set the new refresh token in the cookie
      this.authUtilityService.setRefreshTokenCookie(res, tokens.refresh_token);
      this.authUtilityService.setAccessTokenCookie(res, tokens.access_token);
    });
  }
}
