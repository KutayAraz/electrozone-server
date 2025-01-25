import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { Request } from "express";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../../users/services/user.service";
import { AppError } from "src/common/errors/app-error";
import { ErrorType } from "src/common/errors/error-type";
import { JwtPayloadWithRt } from "src/users/types/jwt-payload-with-rt.type";
import { JwtPayload } from "src/users/types/jwt-payload.type";

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(
    private readonly userService: UserService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        return req.cookies?.refresh_token;
      },
      secretOrKey: config.get<string>("RT_SECRET"),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayloadWithRt> {
    const refreshToken = req.cookies?.refresh_token;

    if (!payload.sub) {
      throw new AppError(ErrorType.UNAUTHORIZED, "Invalid refresh token", HttpStatus.UNAUTHORIZED);
    }

    // Check if the user still exists
    const user = await this.userService.findByUuid(payload.sub);
    if (!user) {
      throw new AppError(
        ErrorType.USER_NOT_FOUND,
        "User no longer exists",
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Verify that the refresh token hasn't been revoked
    if (!user.hashedRt) {
      throw new AppError(
        ErrorType.SESSION_EXPIRED,
        "Session is no longer valid",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      ...payload,
      refreshToken,
    };
  }
}
