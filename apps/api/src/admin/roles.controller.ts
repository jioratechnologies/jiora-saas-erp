import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSION_CATALOG, isPlatformPermission } from "@saas-erp/permissions";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { CreateRoleDto, UpdateRoleDto } from "./dto";

/** The Role Builder: tenant Admin creates/edits/deletes custom roles from the permission catalog. */
@ApiTags("admin: roles")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("admin/roles")
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  /** The catalog of permissions a tenant Admin is allowed to build roles from (platform.* excluded). */
  @Get("permission-catalog")
  @RequirePermission("admin.role.read")
  permissionCatalog() {
    return PERMISSION_CATALOG.filter((p) => !isPlatformPermission(p.key));
  }

  @Get()
  @RequirePermission("admin.role.read")
  list(@CurrentUser() user: AuthContext) {
    return this.prisma.runInTenantContext({ tenantId: user.tenantId!, isPlatformContext: false }, (tx) =>
      this.rbac.listRoles(tx, user.tenantId!),
    );
  }

  @Post()
  @RequirePermission("admin.role.write")
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateRoleDto) {
    return this.prisma.runInTenantContext({ tenantId: user.tenantId!, isPlatformContext: false }, (tx) =>
      this.rbac.createRole(tx, user.tenantId!, dto.name, dto.permissionKeys),
    );
  }

  @Patch(":id")
  @RequirePermission("admin.role.write")
  update(@CurrentUser() user: AuthContext, @Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.prisma.runInTenantContext({ tenantId: user.tenantId!, isPlatformContext: false }, (tx) =>
      this.rbac.updateRole(tx, user.tenantId!, id, dto.name, dto.permissionKeys),
    );
  }

  @Delete(":id")
  @RequirePermission("admin.role.delete")
  delete(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.prisma.runInTenantContext({ tenantId: user.tenantId!, isPlatformContext: false }, (tx) =>
      this.rbac.deleteRole(tx, user.tenantId!, id),
    );
  }
}
