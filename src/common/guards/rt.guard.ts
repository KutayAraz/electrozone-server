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
    return super.canActivate(context);
  }

  handleRequest(err: Error | null, user: any, info: { message: string } | undefined) {
    if (info && info.message === "jwt expired") {
      throw new AppError(
        ErrorType.SESSION_EXPIRED,
        "Your session has expired, please login again.",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (err || !user) {
      throw new AppError(ErrorType.UNAUTHORIZED, "Invalid refresh token", HttpStatus.UNAUTHORIZED);
    }
    return user;
  }
}
