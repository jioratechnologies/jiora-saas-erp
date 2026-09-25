import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthContext } from "./auth-context";

/** Usage: `handler(@CurrentUser() ctx: AuthContext)` inside any @RequirePermission-guarded route. */
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthContext => {
  const request = context.switchToHttp().getRequest();
  return request.authContext;
});
