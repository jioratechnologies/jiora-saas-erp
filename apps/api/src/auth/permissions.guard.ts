import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { isPlatformPermission } from "@saas-erp/permissions";
import { PERMISSION_KEY } from "./require-permission.decorator";
import type { AuthContext } from "./auth-context";

/**
 * Runs after ZitadelAuthGuard. Reads the permission key set by
 * @RequirePermission(...) and checks it against the caller's
 * request.authContext.permissionKeys.
 *
 * Platform permissions (the "platform.*" namespace) additionally require
 * isPlatformContext — a tenant-scoped role can never be granted a
 * platform.* key in the first place (see RbacService.createRole), but this
 * is checked again here too, since defence-in-depth is cheap.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string | undefined>(PERMISSION_KEY, context.getHandler());
    if (!required) return true; // no @RequirePermission(...) on this route

    const request = context.switchToHttp().getRequest();
    const authContext: AuthContext | undefined = request.authContext;
    if (!authContext) {
      throw new ForbiddenException("No authenticated context");
    }

    if (isPlatformPermission(required) && !authContext.isPlatformContext) {
      throw new ForbiddenException(`Requires platform permission: ${required}`);
    }
    if (!authContext.permissionKeys.has(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}
