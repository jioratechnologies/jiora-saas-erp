import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto";

@ApiTags("admin: departments")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("admin/departments")
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermission("admin.department.read")
  list(@CurrentUser() user: AuthContext) {
    return this.departments.list(user.tenantId!);
  }

  @Post()
  @RequirePermission("admin.department.write")
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(user.tenantId!, dto.name);
  }

  @Delete(":id")
  @RequirePermission("admin.department.delete")
  delete(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.departments.delete(user.tenantId!, id);
  }
}
