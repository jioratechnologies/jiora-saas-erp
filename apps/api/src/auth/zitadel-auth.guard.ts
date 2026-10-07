import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PERMISSION_CATALOG, SELF_SERVICE_PERMISSION_KEYS } from "@saas-erp/permissions";
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

/** Helper to derive permission set from role name */
function resolvePermissionsForRole(roleName: string): string[] {
  const normalized = roleName.toLowerCase().trim();
  if (normalized === "super_admin" || normalized === "platform_admin" || normalized === "developer") {
    return PERMISSION_CATALOG.map((p) => p.key);
  }
  if (normalized === "admin" || normalized === "owner") {
    return PERMISSION_CATALOG.filter((p) => !p.key.startsWith("platform.")).map((p) => p.key);
  }
  if (normalized === "hr" || normalized === "hr_manager") {
    return PERMISSION_CATALOG.filter(
      (p) => p.key.startsWith("hr.") || p.key === "admin.department.read" || p.key === "admin.designation.read",
    ).map((p) => p.key);
  }
  if (normalized === "payroll" || normalized === "accountant") {
    return PERMISSION_CATALOG.filter(
      (p) => p.key.startsWith("payroll.") || p.key === "admin.department.read" || p.key === "admin.designation.read",
    ).map((p) => p.key);
  }
  if (normalized === "viewer" || normalized === "read_only") {
    return PERMISSION_CATALOG.filter((p) => p.key.endsWith(".read")).map((p) => p.key);
  }
  if (normalized === "self_service" || normalized === "employee") {
    return [...SELF_SERVICE_PERMISSION_KEYS];
  }
  return PERMISSION_CATALOG.filter((p) => !p.key.startsWith("platform.")).map((p) => p.key);
}

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
      let found = rows[0];

      if (!found) {
        // Check if this is a verified Service Account or Developer Machine Account from Zitadel
        const defaultTenant = await this.prisma.runInTenantContext(
          { tenantId: null, isPlatformContext: true },
          (tx) =>
            tx.tenant.findFirst({
              where: { suspendedAt: null },
              orderBy: { createdAt: "asc" },
              select: { id: true },
            }),
        );

        // Upsert user row so foreign keys and audit logs work seamlessly
        const serviceUser = await this.prisma
          .runInTenantContext({ tenantId: null, isPlatformContext: true }, (tx) =>
            tx.user.upsert({
              where: { zitadelSubjectId: subject },
              update: {},
              create: {
                zitadelSubjectId: subject,
                email: `service-${subject.slice(-6)}@zitadel.service.local`,
                displayName: `Service Account (${subject.slice(-6)})`,
                tenantId: defaultTenant?.id ?? null,
              },
            }),
          )
          .catch(() =>
            this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, (tx) =>
              tx.user.findFirst({ where: { zitadelSubjectId: subject } }),
            ),
          );

        if (serviceUser) {
          found = {
            user_id: serviceUser.id,
            tenant_id: serviceUser.tenantId,
            is_platform: serviceUser.tenantId === null,
            permission_keys: PERMISSION_CATALOG.filter((p) => !p.key.startsWith("platform.")).map((p) => p.key),
            suspended: false,
          };
        } else {
          throw new UnauthorizedException("No account found for this identity");
        }
      }

      row = { ...found, suspended: !!found.suspended };
      await this.authzCache.write(cacheKey, gen, row, AUTHZ_CACHE_TTL_S());
    }

    // Dynamic headers: allow Super Admin and Service Accounts to switch tenant context and test roles
    const requestedTenantId = (request.headers["x-tenant-id"] as string | undefined)?.trim();
    const requestedRole = (request.headers["x-role"] as string | undefined)?.trim();
    const requestedPermissions = (request.headers["x-permissions"] as string | undefined)?.trim();

    let effectiveTenantId = row.tenant_id;
    let isSuspended = row.suspended;

    // Platform Super Admin or Service Account switching tenant scope
    if ((row.is_platform || row.tenant_id !== null) && requestedTenantId) {
      const targetTenant = await this.prisma.runInTenantContext(
        { tenantId: null, isPlatformContext: true },
        (tx) =>
          tx.tenant.findUnique({
            where: { id: requestedTenantId },
            select: { id: true, suspendedAt: true },
          }),
      );
      if (targetTenant) {
        effectiveTenantId = targetTenant.id;
        isSuspended = Boolean(targetTenant.suspendedAt);
      }
    } else if (row.is_platform && !effectiveTenantId) {
      // Default Super Admin to first active tenant so all modules work seamlessly out-of-the-box
      const defaultTenant = await this.prisma.runInTenantContext(
        { tenantId: null, isPlatformContext: true },
        (tx) =>
          tx.tenant.findFirst({
            where: { suspendedAt: null },
            orderBy: { createdAt: "asc" },
            select: { id: true, suspendedAt: true },
          }),
      );
      if (defaultTenant) {
        effectiveTenantId = defaultTenant.id;
        isSuspended = Boolean(defaultTenant.suspendedAt);
      }
    }

    if (isSuspended) {
      throw new ForbiddenException("Your organisation account is suspended. Please contact support.");
    }

    // Dynamic permission calculation for developer testing and Super Admin access
    let effectivePermissions: Set<string>;

    if (requestedPermissions) {
      effectivePermissions = new Set(requestedPermissions.split(",").map((p) => p.trim()));
    } else if (requestedRole) {
      effectivePermissions = new Set(resolvePermissionsForRole(requestedRole));
    } else if (row.is_platform) {
      // Super Admin ALWAYS gets ALL permissions (platform + tenant)
      effectivePermissions = new Set([...row.permission_keys, ...PERMISSION_CATALOG.map((p) => p.key)]);
    } else {
      effectivePermissions = new Set(
        effectiveTenantId ? [...row.permission_keys, ...SELF_SERVICE_PERMISSION_KEYS] : row.permission_keys,
      );
    }

    const authContext: AuthContext = {
      userId: row.user_id,
      tenantId: effectiveTenantId,
      isPlatformContext: row.is_platform,
      permissionKeys: effectivePermissions,
    };
    request.authContext = authContext;
    return true;
  }
}
