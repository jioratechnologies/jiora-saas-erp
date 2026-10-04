import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { SELF_SERVICE_PERMISSION_KEYS } from "@saas-erp/permissions";
import { PrismaService } from "../prisma/prisma.service";
import { bearerTokenFrom, verifyZitadelToken } from "./verify-token";
import { AUTHZ_CACHE_TTL_S, AuthzCacheService } from "./authz-cache.service";
import type { AuthContext } from "./auth-context";

/** What the guard caches per Zitadel subject (see AuthzCacheService for invalidation). */
export interface CachedAuthz {
  user_id: string;
  tenant_id: string | null;
  is_platform: boolean;
  permission_keys: string[];
  suspended: boolean;
}

/**
 * Verifies the incoming Zitadel-issued JWT, then resolves our own
 * app-side identity for it via the auth_lookup_by_subject() SQL function
 * (see prisma/migrations/20260925040000_auth_lookup_function).
 *
 * Zitadel proves WHO the caller is (AuthN). Everything about WHAT they can
 * do (tenant, roles, permissions — AuthZ) comes from our own Postgres
 * tables, looked up here and attached to `request.authContext`. The lookup
 * is cached in Redis for AUTHZ_CACHE_TTL_S (45s) and invalidated on every
 * write that can change it — see AuthzCacheService.
 */
@Injectable()
export class ZitadelAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authzCache: AuthzCacheService,
  ) {}

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

    const cacheKey = `authz:v1:${subject}`;
    const { value: cached, gen } = await this.authzCache.read<CachedAuthz>(cacheKey);
    let row: CachedAuthz | null = cached;
    if (!row) {
      // One round trip: identity lookup + tenant suspension check together.
      const rows = await this.prisma.$queryRaw<Array<Omit<CachedAuthz, "suspended"> & { suspended: boolean | null }>>`
        SELECT l.*, CASE WHEN l.tenant_id IS NULL THEN false ELSE auth_tenant_suspended(l.tenant_id) END AS suspended
        FROM auth_lookup_by_subject(${subject}) AS l`;
      const found = rows[0];
      if (!found) {
        // Verified identity, but no app-side profile — not invited to any
        // tenant, and not a platform user. Distinct from a bad/expired token.
        throw new UnauthorizedException("No account found for this identity");
      }
      row = { ...found, suspended: !!found.suspended };
      await this.authzCache.write(cacheKey, gen, row, AUTHZ_CACHE_TTL_S());
    }

    if (row.suspended) {
      throw new ForbiddenException("Your organisation account is suspended. Please contact support.");
    }

    const authContext: AuthContext = {
      userId: row.user_id,
      tenantId: row.tenant_id,
      isPlatformContext: row.is_platform,
      // Tenant users always get the self-service set; their designation adds to it.
      permissionKeys: new Set(row.tenant_id ? [...row.permission_keys, ...SELF_SERVICE_PERMISSION_KEYS] : row.permission_keys),
    };
    request.authContext = authContext;
    return true;
  }
}
