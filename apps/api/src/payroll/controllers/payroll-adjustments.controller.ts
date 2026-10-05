import { BadRequestException, Body, Controller, Delete, Get, Logger, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../../auth/zitadel-auth.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthContext } from "../../auth/auth-context";
import { PayrollAdjustmentsService } from "../services/payroll-adjustments.service";
import { PayrollRunService } from "../services/payroll-run.service";
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
  private readonly logger = new Logger(PayrollAdjustmentsController.name);

  constructor(
    private readonly service: PayrollAdjustmentsService,
    private readonly runs: PayrollRunService,
  ) {}

  /** Refresh an already-calculated run so the change shows up in payslips straight away. */
  private async refreshRun(tenantId: string, year: number, month: number) {
    try {
      if (await this.service.hasEditableRun(tenantId, year, month)) {
        await this.runs.executeRun(tenantId, { year, month });
      }
    } catch (err) {
      this.logger.warn(`Payroll auto-recalculation failed for ${month}/${year}: ${(err as Error).message}`);
    }
  }

  @Post()
  @RequirePermission("payroll.run.manage")
  @ApiOperation({ summary: "Add a one-off bonus, allowance or deduction to a month's payroll" })
  async create(@CurrentUser() user: AuthContext, @Body() dto: CreatePayrollAdjustmentDto) {
    const created = await this.service.create(user.tenantId!, user.userId, dto);
    await this.refreshRun(user.tenantId!, dto.year, dto.month);
    return created;
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
  async remove(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    const removed = await this.service.remove(user.tenantId!, id);
    await this.refreshRun(user.tenantId!, removed.year, removed.month);
    return removed;
  }
}
