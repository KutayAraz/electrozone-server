import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayloadWithRt } from "src/users/types";

export const RefreshTokenUserUuid = createParamDecorator(
  (_: undefined, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayloadWithRt;
    return user.sub;
  },
);
