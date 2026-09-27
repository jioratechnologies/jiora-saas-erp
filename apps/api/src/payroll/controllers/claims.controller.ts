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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ExpenseClaimCategory, ExpenseClaimStatus, SalaryAdvanceStatus } from "@prisma/client";
import { ZitadelAuthGuard } from "../../auth/zitadel-auth.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthContext } from "../../auth/auth-context";
import { ClaimsService } from "../services/claims.service";
import { PersonsService } from "../../hr/services/persons.service";
import { StorageService } from "../../storage/storage.service";
import {
  DecideExpenseClaimDto,
  DecideSalaryAdvanceDto,
  RequestSalaryAdvanceDto,
  SettleExpenseClaimDto,
  SubmitExpenseClaimDto,
} from "../dto/claims.dto";

@ApiTags("payroll/claims")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("payroll/claims")
export class ClaimsController {
  constructor(
    private readonly service: ClaimsService,
    private readonly personsService: PersonsService,
    private readonly storage: StorageService,
  ) {}

  private async resolvePersonId(user: AuthContext): Promise<string> {
    const person = await this.personsService.getByUserId(user.tenantId!, user.userId);
    if (!person) {
      throw new NotFoundException("No Employee or Person record linked to your user account.");
    }
    return person.id;
  }

  // ==========================================
  // Expense Claims
  // ==========================================

  @Post("expenses")
  @RequirePermission("payroll.claim.apply")
  @ApiOperation({ summary: "Submit an expense or reimbursement claim" })
  async submitClaim(@CurrentUser() user: AuthContext, @Body() dto: SubmitExpenseClaimDto) {
    const personId = await this.resolvePersonId(user);
    return this.service.submitClaim(user.tenantId!, personId, dto);
  }

  @Post("expenses/:id/receipt")
  @RequirePermission("payroll.claim.apply")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload receipt image or document for an expense claim" })
  async uploadReceipt(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Receipt file is required.");
    const personId = await this.resolvePersonId(user);

    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException("Invalid file type. Allowed: PDF, JPEG, PNG.");
    }

    const fileKey = `tenants/${user.tenantId}/claims/${id}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    await this.storage.uploadFile(fileKey, file.buffer, file.mimetype);
    const presignedUrl = await this.storage.getPresignedUrl(fileKey);

    return { fileKey, url: presignedUrl, name: file.originalname };
  }

  @Get("expenses")
  @RequirePermission("payroll.claim.read")
  @ApiOperation({ summary: "List expense and reimbursement claims with filters" })
  listClaims(
    @CurrentUser() user: AuthContext,
    @Query("personId") personId?: string,
    @Query("status") status?: ExpenseClaimStatus,
    @Query("category") category?: ExpenseClaimCategory,
  ) {
    return this.service.listClaims(user.tenantId!, { personId, status, category });
  }

  @Get("expenses/my")
  @ApiOperation({ summary: "List current staff member's own submitted claims" })
  async listMyClaims(@CurrentUser() user: AuthContext, @Query("status") status?: ExpenseClaimStatus) {
    const personId = await this.resolvePersonId(user);
    return this.service.listClaims(user.tenantId!, { personId, status });
  }

  @Patch("expenses/:id/decide")
  @RequirePermission("payroll.claim.manage")
  @ApiOperation({ summary: "Approve or reject an expense claim" })
  async decideClaim(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: DecideExpenseClaimDto,
  ) {
    const approverPersonId = await this.resolvePersonId(user);
    return this.service.decideClaim(user.tenantId!, id, approverPersonId, dto);
  }

  @Patch("expenses/:id/settle")
  @RequirePermission("payroll.claim.manage")
  @ApiOperation({ summary: "Record payment settlement for an approved claim" })
  settleClaim(@CurrentUser() user: AuthContext, @Param("id") id: string, @Body() dto: SettleExpenseClaimDto) {
    return this.service.settleClaim(user.tenantId!, id, dto);
  }

  // ==========================================
  // Salary Advances
  // ==========================================

  @Post("advances")
  @RequirePermission("payroll.advance.apply")
  @ApiOperation({ summary: "Submit an emergency salary advance request" })
  async requestAdvance(@CurrentUser() user: AuthContext, @Body() dto: RequestSalaryAdvanceDto) {
    const personId = await this.resolvePersonId(user);
    return this.service.requestAdvance(user.tenantId!, personId, dto);
  }

  @Get("advances")
  @RequirePermission("payroll.advance.manage")
  @ApiOperation({ summary: "List salary advance requests for management review" })
  listAdvances(
    @CurrentUser() user: AuthContext,
    @Query("personId") personId?: string,
    @Query("status") status?: SalaryAdvanceStatus,
  ) {
    return this.service.listAdvances(user.tenantId!, { personId, status });
  }

  @Get("advances/my")
  @ApiOperation({ summary: "List current employee's salary advance requests" })
  async listMyAdvances(@CurrentUser() user: AuthContext) {
    const personId = await this.resolvePersonId(user);
    return this.service.listAdvances(user.tenantId!, { personId });
  }

  @Patch("advances/:id/decide")
  @RequirePermission("payroll.advance.manage")
  @ApiOperation({ summary: "Approve or reject a salary advance request" })
  async decideAdvance(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: DecideSalaryAdvanceDto,
  ) {
    const approverPersonId = await this.resolvePersonId(user);
    return this.service.decideAdvance(user.tenantId!, id, approverPersonId, dto);
  }
}
