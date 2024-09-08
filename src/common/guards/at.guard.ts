import { ExecutionContext, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AppError } from '../errors/app-error';
import { ErrorType } from '../errors/error-type';
@Injectable()
export class AtGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (info && info.message === 'jwt expired') {
      throw new AppError(
        ErrorType.SESSION_EXPIRED,
        'Your session has expired, please login again.',
        HttpStatus.UNAUTHORIZED
      );
    }
    if (err || !user) {
      throw new AppError(
        ErrorType.UNAUTHORIZED,
        'Access denied',
        HttpStatus.UNAUTHORIZED
      );
    }
    return user;
  }
}