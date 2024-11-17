import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "src/users/types/jwt-payload.type";

export const UserUuid = createParamDecorator((_: undefined, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest();
  const user = request.user as JwtPayload;
  return user.sub;
});
