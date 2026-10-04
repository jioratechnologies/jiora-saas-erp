import { Body, Controller, Delete, Get, Param, Post, UseGuards, Header } from "@nestjs/common";
import { REFERENCE_CACHE_CONTROL } from "../cache/ref-cache";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { DesignationsService } from "./designations.service";
import { CreateDesignationDto } from "./dto";

@ApiTags("admin: designations")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("admin/designations")
export class DesignationsController {
  constructor(private readonly designations: DesignationsService) {}

  @Get()
  @RequirePermission("admin.designation.read")
  @Header("Cache-Control", REFERENCE_CACHE_CONTROL)
  list(@CurrentUser() user: AuthContext) {
    return this.designations.list(user.tenantId!);
  }

  @Post()
  @RequirePermission("admin.designation.write")
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateDesignationDto) {
    return this.designations.create(user.tenantId!, dto.name);
  }

  @Delete(":id")
  @RequirePermission("admin.designation.delete")
  delete(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.designations.delete(user.tenantId!, id);
  }
}
