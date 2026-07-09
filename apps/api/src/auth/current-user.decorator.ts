import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "../users/users.service.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
