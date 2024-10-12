import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, JwtPayloadWithRt } from '../../users/types';
import { UserService } from '../../users/services/user.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorType } from 'src/common/errors/error-type';

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly userService: UserService, config: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        return req.cookies?.refresh_token;
      },
      secretOrKey: config.get<string>('RT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayloadWithRt> {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new AppError(ErrorType.FORBIDDEN, 'Refresh token malformed', HttpStatus.FORBIDDEN);
    }

    if (!payload.sub) {
      throw new AppError(ErrorType.UNAUTHORIZED, 'Invalid token payload', HttpStatus.UNAUTHORIZED);
    }

    // Check if the user still exists
    const user = await this.userService.findByUuid(payload.sub);
    if (!user) {
      throw new AppError(ErrorType.UNAUTHORIZED, 'User no longer exists', HttpStatus.UNAUTHORIZED);
    }

    return {
      ...payload,
      refreshToken,
    };
  }
}
