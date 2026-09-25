import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { TenantsService } from "../tenants/tenants.service";
import { UpdateTenantThemeDto } from "../tenants/dto";

/** The tenant's own organisation profile — name, theme, branding. Not platform tenant CRUD (see tenants.controller.ts). */
@ApiTags("admin: organisation")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("admin/org")
export class OrgController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @RequirePermission("admin.org.read")
  get(@CurrentUser() user: AuthContext) {
    return this.tenants.getOwn(user.tenantId!);
  }

  @Patch("theme")
  @RequirePermission("admin.org.write")
  updateTheme(@CurrentUser() user: AuthContext, @Body() dto: UpdateTenantThemeDto) {
    return this.tenants.updateTheme(user.tenantId!, dto);
  }
}
