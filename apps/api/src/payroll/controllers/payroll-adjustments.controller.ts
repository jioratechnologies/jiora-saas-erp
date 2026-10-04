import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../../auth/zitadel-auth.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthContext } from "../../auth/auth-context";
import { PayrollAdjustmentsService } from "../services/payroll-adjustments.service";
import { CreatePayrollAdjustmentDto } from "../dto/payroll-adjustment.dto";

const intOrUndef = (v: string | undefined, min: number, max: number): number | undefined => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new BadRequestException("Please check the highlighted fields and try again.");
  }
  return n;
};

@ApiTags("payroll/adjustments")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("payroll/adjustments")
export class PayrollAdjustmentsController {
  constructor(private readonly service: PayrollAdjustmentsService) {}

  @Post()
  @RequirePermission("payroll.run.manage")
  @ApiOperation({ summary: "Add a one-off bonus, allowance or deduction to a month's payroll" })
  create(@CurrentUser() user: AuthContext, @Body() dto: CreatePayrollAdjustmentDto) {
    return this.service.create(user.tenantId!, user.userId, dto);
  }

  @Get()
  @RequirePermission("payroll.run.read")
  @ApiOperation({ summary: "List payroll adjustments" })
  list(
    @CurrentUser() user: AuthContext,
    @Query("year") year?: string,
    @Query("month") month?: string,
    @Query("personId") personId?: string,
  ) {
    return this.service.list(user.tenantId!, {
      year: intOrUndef(year, 2000, 2100),
      month: intOrUndef(month, 1, 12),
      personId: personId || undefined,
    });
  }

  @Delete(":id")
  @RequirePermission("payroll.run.manage")
  @ApiOperation({ summary: "Remove an adjustment while the month is not approved" })
  remove(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.service.remove(user.tenantId!, id);
  }
}
