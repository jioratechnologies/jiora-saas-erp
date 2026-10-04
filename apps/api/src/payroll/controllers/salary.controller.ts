import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../../auth/zitadel-auth.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthContext } from "../../auth/auth-context";
import { SalaryService } from "../services/salary.service";
import {
  AssignSalaryDto,
  CreateSalaryComponentDto,
  CreateSalaryStructureDto,
  RecordSalaryRevisionDto,
  UpdateSalaryComponentDto,
} from "../dto/salary.dto";

@ApiTags("payroll/salary")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("payroll/salary")
export class SalaryController {
  constructor(private readonly service: SalaryService) {}

  // ==========================================
  // Components
  // ==========================================

  @Get("components")
  @RequirePermission("payroll.salary.read")
  @ApiOperation({ summary: "List salary components (earnings and deductions)" })
  listComponents(@CurrentUser() user: AuthContext) {
    return this.service.listComponents(user.tenantId!);
  }

  @Post("components")
  @RequirePermission("payroll.salary.manage")
  @ApiOperation({ summary: "Create a new salary component" })
  createComponent(@CurrentUser() user: AuthContext, @Body() dto: CreateSalaryComponentDto) {
    return this.service.createComponent(user.tenantId!, dto);
  }

  @Patch("components/:id")
  @RequirePermission("payroll.salary.manage")
  @ApiOperation({ summary: "Update an existing salary component" })
  updateComponent(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: UpdateSalaryComponentDto,
  ) {
    return this.service.updateComponent(user.tenantId!, id, dto);
  }

  // ==========================================
  // Structures
  // ==========================================

  @Get("structures")
  @RequirePermission("payroll.salary.read")
  @ApiOperation({ summary: "List salary structure templates" })
  listStructures(@CurrentUser() user: AuthContext) {
    return this.service.listStructures(user.tenantId!);
  }

  @Post("structures")
  @RequirePermission("payroll.salary.manage")
  @ApiOperation({ summary: "Create a salary structure template" })
  createStructure(@CurrentUser() user: AuthContext, @Body() dto: CreateSalaryStructureDto) {
    return this.service.createStructure(user.tenantId!, dto);
  }

  @Get("settings")
  @RequirePermission("payroll.salary.read")
  @ApiOperation({ summary: "Org-wide salary split and working-day settings" })
  getSettings(@CurrentUser() user: AuthContext) {
    return this.service.getSettings(user.tenantId!);
  }

  @Get("staff")
  @RequirePermission("payroll.salary.read")
  @ApiOperation({ summary: "List employees with their salary (if set)" })
  listStaff(@CurrentUser() user: AuthContext) {
    return this.service.listStaff(user.tenantId!, user.permissionKeys.has("payroll.salary.manage"));
  }

  // ==========================================
  // Employee Assignments
  // ==========================================

  @Get("assignments")
  @RequirePermission("payroll.salary.read")
  @ApiOperation({ summary: "List all employee compensation assignments" })
  listAssignments(@CurrentUser() user: AuthContext) {
    return this.service.listAssignments(user.tenantId!, user.permissionKeys.has("payroll.salary.manage"));
  }

  @Get("assignments/person/:personId")
  @RequirePermission("payroll.salary.read")
  @ApiOperation({ summary: "Get salary assignment for a specific employee" })
  getAssignment(@CurrentUser() user: AuthContext, @Param("personId") personId: string) {
    return this.service.getAssignmentByPerson(user.tenantId!, personId);
  }

  @Post("assignments")
  @RequirePermission("payroll.salary.manage")
  @ApiOperation({ summary: "Assign or update salary for an employee" })
  assignSalary(@CurrentUser() user: AuthContext, @Body() dto: AssignSalaryDto) {
    return this.service.assignSalary(user.tenantId!, dto, user.userId);
  }

  // ==========================================
  // Revisions & Promotions
  // ==========================================

  @Get("revisions")
  @RequirePermission("payroll.salary.read")
  @ApiOperation({ summary: "List appraisal and salary revision history" })
  listRevisions(@CurrentUser() user: AuthContext, @Query("personId") personId?: string) {
    return this.service.listRevisions(user.tenantId!, personId);
  }

  @Post("revisions")
  @RequirePermission("payroll.salary.manage")
  @ApiOperation({ summary: "Record a salary increase, appraisal or designation promotion" })
  recordRevision(@CurrentUser() user: AuthContext, @Body() dto: RecordSalaryRevisionDto) {
    return this.service.recordRevision(user.tenantId!, user.userId, dto, {
      userId: user.userId,
      permissionKeys: user.permissionKeys,
      isPlatform: user.isPlatformContext,
    });
  }
}
