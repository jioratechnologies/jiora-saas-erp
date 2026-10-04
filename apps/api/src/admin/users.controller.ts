import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { UsersService } from "./users.service";
import { InviteUserDto } from "./dto";

@ApiTags("admin: users")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("admin/users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission("admin.user.read")
  list(@CurrentUser() user: AuthContext) {
    return this.users.list(user.tenantId!);
  }

  @Post("invite")
  @RequirePermission("admin.user.invite")
  invite(@CurrentUser() user: AuthContext, @Body() dto: InviteUserDto) {
    return this.users.invite(user.tenantId!, dto, {
      userId: user.userId,
      isPlatform: user.isPlatformContext,
      permissionKeys: user.permissionKeys,
    });
  }

  @Patch(":id/deactivate")
  @RequirePermission("admin.user.deactivate")
  deactivate(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.users.deactivate(user.tenantId!, id);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("admin.user.deactivate")
  async remove(@CurrentUser() user: AuthContext, @Param("id") id: string): Promise<void> {
    await this.users.remove(user.tenantId!, id, user.userId);
  }
}
