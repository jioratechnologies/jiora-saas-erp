import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto, InviteOwnerDto } from "./dto";

/**
 * Super Admin panel API — platform-level, cross-tenant. Every route here
 * requires a platform.* permission, which only the three fixed platform
 * roles (super_admin/developer/maintainer) can ever hold — see
 * packages/permissions and rbac.service.ts.
 */
@ApiTags("tenants (platform)")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("platform/tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @RequirePermission("platform.tenant.read")
  list() {
    return this.tenants.list();
  }

  @Post()
  @RequirePermission("platform.tenant.write")
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Patch(":id/suspend")
  @RequirePermission("platform.tenant.suspend")
  suspend(@Param("id") id: string) {
    return this.tenants.suspend(id);
  }

  @Patch(":id/reinstate")
  @RequirePermission("platform.tenant.suspend")
  reinstate(@Param("id") id: string) {
    return this.tenants.reinstate(id);
  }

  /** Bootstraps a tenant's first user (its owner) — see TenantsService.inviteOwner for why this has to exist. */
  @Post(":id/invite-owner")
  @RequirePermission("platform.tenant.write")
  inviteOwner(@Param("id") id: string, @Body() dto: InviteOwnerDto) {
    return this.tenants.inviteOwner(id, dto);
  }

  @Get(":id/users")
  @RequirePermission("platform.tenant.read")
  listUsers(@Param("id") id: string) {
    return this.tenants.listUsers(id);
  }

  @Delete(":id/users/:userId/invite")
  @RequirePermission("platform.tenant.write")
  cancelInvite(@Param("id") id: string, @Param("userId") userId: string) {
    return this.tenants.cancelInvite(id, userId);
  }
}
