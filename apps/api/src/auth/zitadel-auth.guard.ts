import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { bearerTokenFrom, verifyZitadelToken } from "./verify-token";
import type { AuthContext } from "./auth-context";

/**
 * Verifies the incoming Zitadel-issued JWT, then resolves our own
 * app-side identity for it via the auth_lookup_by_subject() SQL function
 * (see prisma/migrations/20260925040000_auth_lookup_function).
 *
 * Zitadel proves WHO the caller is (AuthN). Everything about WHAT they can
 * do (tenant, roles, permissions — AuthZ) comes from our own Postgres
 * tables, looked up here and attached to `request.authContext`.
 */
@Injectable()
export class ZitadelAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    let subject: string;
    try {
      const token = bearerTokenFrom(request.headers?.authorization);
      const payload = await verifyZitadelToken(token);
      if (!payload.sub) throw new Error("token has no sub claim");
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ user_id: string; tenant_id: string | null; is_platform: boolean; permission_keys: string[] }>
    >`SELECT * FROM auth_lookup_by_subject(${subject})`;

    const row = rows[0];
    if (!row) {
      // Verified identity, but no app-side profile — not invited to any
      // tenant, and not a platform user. Distinct from a bad/expired token.
      throw new UnauthorizedException("No account found for this identity");
    }

    const authContext: AuthContext = {
      userId: row.user_id,
      tenantId: row.tenant_id,
      isPlatformContext: row.is_platform,
      permissionKeys: new Set(row.permission_keys),
    };
    request.authContext = authContext;
    return true;
  }
}
