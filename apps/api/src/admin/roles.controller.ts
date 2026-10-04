import { Body, Controller, Get, Header, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSION_CATALOG, SELF_SERVICE_PERMISSION_KEYS, isPlatformPermission } from "@saas-erp/permissions";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { AuthzCacheService } from "../auth/authz-cache.service";
import { REFERENCE_CACHE_CONTROL } from "../cache/ref-cache";
import { UpdateRoleDto } from "./dto";

/** Static (compile-time) catalog: built once, not per request. */
const TENANT_PERMISSION_CATALOG = PERMISSION_CATALOG.filter((p) => !isPlatformPermission(p.key)).map((p) => ({
  ...p,
  // selfService: granted to every tenant user, so the UI shows it as always on.
  selfService: SELF_SERVICE_PERMISSION_KEYS.includes(p.key),
}));

/** Designation access: each designation's role holds the permissions its people get. Roles are created and deleted with their designation. */
@ApiTags("admin: roles")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("admin/roles")
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly authzCache: AuthzCacheService,
  ) {}

  /** The catalog of permissions a tenant Admin is allowed to build roles from (platform.* excluded). */
  @Get("permission-catalog")
  @RequirePermission("admin.role.read")
  @Header("Cache-Control", REFERENCE_CACHE_CONTROL)
  permissionCatalog() {
    return TENANT_PERMISSION_CATALOG;
  }

  @Get()
  @RequirePermission("admin.role.read")
  list(@CurrentUser() user: AuthContext) {
    return this.prisma.runInTenantContext({ tenantId: user.tenantId!, isPlatformContext: false }, (tx) =>
      this.rbac.listRoles(tx, user.tenantId!),
    );
  }

  @Patch(":id")
  @RequirePermission("admin.role.write")
  async update(@CurrentUser() user: AuthContext, @Param("id") id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.prisma.runInTenantContext({ tenantId: user.tenantId!, isPlatformContext: false }, (tx) =>
      this.rbac.updateRolePermissions(tx, user.tenantId!, id, dto.permissionKeys),
    );
    // After commit: cached guard identities hold the old permission keys.
    await this.authzCache.invalidateTenantAuthz(user.tenantId);
    return role;
  }
}
