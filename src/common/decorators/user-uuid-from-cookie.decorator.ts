import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
} from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { AppError } from "../errors/app-error";
import { ErrorType } from "../errors/error-type";

export const RefreshTokenUserUuid = createParamDecorator(
  (_: undefined, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest();
    const rawToken = request.cookies?.refresh_token;

    if (!rawToken) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'Session Expired', HttpStatus.FORBIDDEN);
    }

    const decoded: any = jwt.decode(rawToken);

    if (!decoded?.sub) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'Access Denied', HttpStatus.UNAUTHORIZED);
    }

    return decoded.sub;
  },
);
