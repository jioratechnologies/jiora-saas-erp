import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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
  list(@CurrentUser() user: AuthContext) {
    return this.departments.list(user.tenantId!);
  }

  @Post()
  @RequirePermission("admin.department.write")
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(user.tenantId!, dto.name);
  }

  @Patch(":id/members")
  @RequirePermission("admin.department.write")
  assignMember(
    @CurrentUser() user: AuthContext,
    @Param("id") departmentId: string,
    @Body() dto: { personId: string; managerId?: string | null },
  ) {
    return this.departments.assignMember(user.tenantId!, departmentId, dto.personId, dto.managerId);
  }

  @Delete(":id")
  @RequirePermission("admin.department.delete")
  delete(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.departments.delete(user.tenantId!, id);
  }
}
