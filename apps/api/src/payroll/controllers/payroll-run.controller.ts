import {
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
import { PayrollRunService } from "../services/payroll-run.service";
import { PersonsService } from "../../hr/services/persons.service";
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
    private readonly personsService: PersonsService,
  ) {}

  private async resolvePersonId(user: AuthContext): Promise<string> {
    const person = await this.personsService.getByUserId(user.tenantId!, user.userId);
    if (!person) {
      throw new NotFoundException("No Employee or Person record linked to your user account.");
    }
    return person.id;
  }

  @Get()
  @RequirePermission("payroll.run.read")
  @ApiOperation({ summary: "List monthly payroll runs" })
  listRuns(@CurrentUser() user: AuthContext, @Query("year") year?: string) {
    return this.service.listRuns(user.tenantId!, year ? parseInt(year, 10) : undefined);
  }

  @Get("my-payslips")
  @ApiOperation({ summary: "Get current employee's payslip history" })
  async getMyPayslips(@CurrentUser() user: AuthContext) {
    const personId = await this.resolvePersonId(user);
    return this.service.getMyPayslips(user.tenantId!, personId);
  }

  @Get("payslips/:id")
  @RequirePermission("payroll.payslip.read")
  @ApiOperation({ summary: "Get full details of a payslip voucher" })
  getPayslip(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.service.getPayslipById(user.tenantId!, id);
  }

  @Get(":id")
  @RequirePermission("payroll.run.read")
  @ApiOperation({ summary: "Get payroll run by ID with all itemized payslips" })
  getRunById(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.service.getRunById(user.tenantId!, id);
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
