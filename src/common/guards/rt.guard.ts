import { ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AppError } from "../errors/app-error";
import { ErrorType } from "../errors/error-type";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RtGuard extends AuthGuard("jwt-refresh") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const refreshToken = request.cookies?.refresh_token;

    if (!refreshToken) {
      throw new AppError(
        ErrorType.UNAUTHORIZED,
        "No refresh token provided",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Only need to handle unexpected errors here
    // Token validation errors are handled by the strategy

    console.log("RT GUARD", err, user, info);
    if (err || !user) {
      throw new AppError(ErrorType.UNAUTHORIZED, "Invalid session", HttpStatus.UNAUTHORIZED);
    }

    return user;
  }
}
