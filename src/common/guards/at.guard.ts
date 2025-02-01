import { ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { AppError } from "../errors/app-error";
import { ErrorType } from "../errors/error-type";

@Injectable()
export class AtGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const accessToken = request.cookies?.access_token;

    // Early check if access token exists
    if (!accessToken) {
      throw new AppError(ErrorType.UNAUTHORIZED, "Access denied", HttpStatus.UNAUTHORIZED);
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (info instanceof Error) {
      throw new AppError(
        ErrorType.UNAUTHORIZED,
        "Token validation failed",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (err || !user) {
      throw new AppError(ErrorType.UNAUTHORIZED, "Access denied", HttpStatus.UNAUTHORIZED);
    }

    return user;
  }
}
