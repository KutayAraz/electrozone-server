import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from "@nestjs/common";
import * as jwt from "jsonwebtoken";

export const GetCurrentUserIdFromCookies = createParamDecorator(
  (_: undefined, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest();
    const rawToken = request.cookies?.refresh_token;

    if (!rawToken) {
      throw new BadRequestException("Token not found in cookie.");
    }

    const decoded: any = jwt.decode(rawToken);

    if (!decoded?.sub) {
      throw new BadRequestException("Invalid token or sub not found.");
    }

    return decoded.sub;
  },
);
