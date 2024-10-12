import { createParamDecorator, ExecutionContext, HttpStatus } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { AppError } from "../errors/app-error";
import { ErrorType } from "../errors/error-type";

export const RefreshTokenUserUuid = createParamDecorator(
  (_: undefined, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    const rawToken = request.cookies?.refresh_token;

    if (!rawToken) {
      throw new AppError(ErrorType.UNAUTHORIZED, "Access Denied", HttpStatus.UNAUTHORIZED);
    }

    const decoded: any = jwt.decode(rawToken);

    return decoded.sub;
  },
);
