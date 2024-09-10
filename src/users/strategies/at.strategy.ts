import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types';
import { UserService } from '../services/user.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorType } from 'src/common/errors/error-type';

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly userService: UserService, config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('AT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email) {
      throw new AppError(ErrorType.UNAUTHORIZED, 'Invalid token payload');
    }
    const user = await this.userService.findByUuid(payload.sub);
    if (!user) {
      throw new AppError(ErrorType.USER_NOT_FOUND, 'User no longer exists');
    }
    return payload;
  }
}
