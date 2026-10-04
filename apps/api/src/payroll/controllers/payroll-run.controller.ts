import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
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
import { parsePaging } from "../../common/pagination";
import { PayrollRunService } from "../services/payroll-run.service";
import { PersonContextService } from "../../auth/person-context.service";
import {
  ExecutePayrollRunDto,
  UpdatePayrollRunStatusDto,
  UpdatePayslipPaymentDto,
} from "../dto/payroll-run.dto";

@ApiTags("payroll/runs")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("payroll/runs")
export class PayrollRunController {
  constructor(
    private readonly service: PayrollRunService,
    private readonly personContext: PersonContextService,
  ) {}

  private async resolvePersonId(user: AuthContext): Promise<string> {
    const person = await this.personContext.get(user.tenantId!, user.userId);
    if (!person) {
      throw new NotFoundException("No Employee or Person record linked to your user account.");
    }
    return person.id;
  }

  @Get()
  @RequirePermission("payroll.run.read")
  @ApiOperation({ summary: "List monthly payroll runs" })
  listRuns(@CurrentUser() user: AuthContext, @Query("year") year?: string) {
    let parsedYear: number | undefined;
    if (year !== undefined && year !== "") {
      parsedYear = Number(year);
      if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        throw new BadRequestException("Please check the highlighted fields and try again.");
      }
    }
    return this.service.listRuns(user.tenantId!, parsedYear);
  }

  @Get("my-payslips")
  @ApiOperation({ summary: "Get current employee's payslip history" })
  async getMyPayslips(
    @CurrentUser() user: AuthContext,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const personId = await this.resolvePersonId(user);
    const paging = parsePaging(page, pageSize);
    if (paging) return this.service.getMyPayslipsPaged(user.tenantId!, personId, paging);
    return this.service.getMyPayslips(user.tenantId!, personId);
  }

  @Get("payslips/:id")
  @RequirePermission("payroll.payslip.read")
  @ApiOperation({ summary: "Get full details of a payslip voucher" })
  async getPayslip(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    const person = await this.personContext.get(user.tenantId!, user.userId);
    const isManager = user.permissionKeys.has("payroll.run.read") || user.permissionKeys.has("payroll.run.manage");
    return this.service.getPayslipById(user.tenantId!, id, { personId: person?.id, isManager, canViewSensitive: user.permissionKeys.has("payroll.salary.manage") });
  }

  @Get("attendance-summary")
  @RequirePermission("payroll.run.read")
  @ApiOperation({ summary: "Per-employee attendance and day-rate pay preview for a month" })
  attendanceSummary(
    @CurrentUser() user: AuthContext,
    @Query("year") year?: string,
    @Query("month") month?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
  ) {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
      throw new BadRequestException("Please check the highlighted fields and try again.");
    }
    return this.service.attendanceSummary(user.tenantId!, y, m, parsePaging(page, pageSize), search);
  }

  @Get("final-settlement/:personId")
  @RequirePermission("payroll.run.read")
  @ApiOperation({ summary: "Final settlement preview for a leaving employee" })
  finalSettlement(@CurrentUser() user: AuthContext, @Param("personId") personId: string) {
    return this.service.finalSettlement(user.tenantId!, personId);
  }

  @Get(":id")
  @RequirePermission("payroll.run.read")
  @ApiOperation({ summary: "Get payroll run by ID with all itemized payslips" })
  getRunById(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.service.getRunById(user.tenantId!, id, user.permissionKeys.has("payroll.salary.manage"));
  }

  @Post("calculate")
  @RequirePermission("payroll.run.manage")
  @ApiOperation({ summary: "Execute attendance-linked monthly payroll calculation" })
  executeRun(@CurrentUser() user: AuthContext, @Body() dto: ExecutePayrollRunDto) {
    return this.service.executeRun(user.tenantId!, dto);
  }

  @Patch(":id/status")
  @RequirePermission("payroll.run.manage")
  @ApiOperation({ summary: "Approve or disburse a payroll run" })
  updateStatus(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: UpdatePayrollRunStatusDto,
  ) {
    return this.service.updateStatus(user.tenantId!, id, user.userId, dto);
  }

  @Patch("payslips/:id/payment")
  @RequirePermission("payroll.run.manage")
  @ApiOperation({ summary: "Update payment status and reference for an individual payslip" })
  updatePayslipPayment(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: UpdatePayslipPaymentDto,
  ) {
    return this.service.updatePayslipPayment(user.tenantId!, id, dto);
  }
}
