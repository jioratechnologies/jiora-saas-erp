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
import { parsePaging } from "../../common/pagination";
import { ClaimsService } from "../services/claims.service";
import { PersonContextService } from "../../auth/person-context.service";
import { StorageService } from "../../storage/storage.service";
import {
  DecideExpenseClaimDto,
  DecideSalaryAdvanceDto,
  RequestSalaryAdvanceDto,
  SettleExpenseClaimDto,
  SubmitExpenseClaimDto,
} from "../dto/claims.dto";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const RECEIPT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

@ApiTags("payroll/claims")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("payroll/claims")
export class ClaimsController {
  constructor(
    private readonly service: ClaimsService,
    private readonly personContext: PersonContextService,
    private readonly storage: StorageService,
  ) {}

  /** Receipts are stored as fileKey only; attach short-lived signed URLs on read. */
  private async signReceipts<T extends { receiptUrls?: unknown }>(claims: T[]): Promise<T[]> {
    return Promise.all(
      claims.map(async (c) => {
        const list = Array.isArray(c.receiptUrls) ? (c.receiptUrls as { name?: string; fileKey?: string }[]) : [];
        const receiptUrls = await Promise.all(
          list.map(async (r) => ({ ...r, url: r.fileKey ? await this.storage.getPresignedUrl(r.fileKey) : undefined })),
        );
        return { ...c, receiptUrls };
      }),
    );
  }

  private async resolvePersonId(user: AuthContext): Promise<string> {
    const person = await this.personContext.get(user.tenantId!, user.userId);
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
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_RECEIPT_BYTES },
      fileFilter: (_req, file, cb) =>
        RECEIPT_MIME_TYPES.includes(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException("Invalid file type. Allowed: PDF, JPEG, PNG."), false),
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload receipt image or document for an expense claim" })
  async uploadReceipt(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Receipt file is required.");
    const personId = await this.resolvePersonId(user);

    if (file.size > MAX_RECEIPT_BYTES) {
      throw new BadRequestException("File is too large. Maximum size is 10 MB.");
    }
    await this.service.getClaimForReceipt(
      user.tenantId!,
      id,
      personId,
      user.permissionKeys.has("payroll.claim.manage"),
    );

    const fileKey = `tenants/${user.tenantId}/claims/${id}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    await this.storage.uploadFile(fileKey, file.buffer, file.mimetype);
    await this.service.addReceipt(user.tenantId!, id, { name: file.originalname, fileKey });
    const presignedUrl = await this.storage.getPresignedUrl(fileKey);

    return { fileKey, url: presignedUrl, name: file.originalname };
  }

  @Get("expenses")
  @RequirePermission("payroll.claim.read")
  @ApiOperation({ summary: "List expense and reimbursement claims with filters" })
  async listClaims(
    @CurrentUser() user: AuthContext,
    @Query("personId") personId?: string,
    @Query("status") status?: ExpenseClaimStatus,
    @Query("category") category?: ExpenseClaimCategory,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const paging = parsePaging(page, pageSize);
    if (!user.permissionKeys.has("payroll.claim.manage")) {
      // Non-managers only ever see their own claims.
      const self = await this.personContext.get(user.tenantId!, user.userId);
      if (!self) return paging
        ? {
            items: [],
            total: 0,
            page: paging.page,
            pageSize: paging.pageSize,
            stats: {
              byStatus: { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0, SETTLED: 0 },
              totalApprovedAmount: 0,
            },
          }
        : [];
      personId = self.id;
    }
    return this.claimsResponse(user, { personId, status, category, search }, paging);
  }

  private async claimsResponse(
    user: AuthContext,
    query: { personId?: string; status?: ExpenseClaimStatus; category?: ExpenseClaimCategory; search?: string },
    paging: ReturnType<typeof parsePaging>,
  ) {
    if (!user.tenantId) {
      return paging
        ? {
            data: [],
            total: 0,
            page: paging.page,
            pageSize: paging.pageSize,
            totalPages: 0,
            stats: {
              byStatus: { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0, SETTLED: 0 },
              totalApprovedAmount: 0,
            },
          }
        : [];
    }
    if (!paging) return this.signReceipts(await this.service.listClaims(user.tenantId, query));
    const res = await this.service.listClaimsPaged(user.tenantId, query, paging);
    return { ...res, items: await this.signReceipts(res.items) };
  }

  @Get("expenses/my")
  @ApiOperation({ summary: "List current staff member's own submitted claims" })
  async listMyClaims(
    @CurrentUser() user: AuthContext,
    @Query("status") status?: ExpenseClaimStatus,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const personId = await this.resolvePersonId(user);
    return this.claimsResponse(user, { personId, status, search }, parsePaging(page, pageSize));
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
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const query = { personId, status, search };
    const paging = parsePaging(page, pageSize);
    if (!user.tenantId) {
      return paging ? { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } : [];
    }
    return paging
      ? this.service.listAdvancesPaged(user.tenantId, query, paging)
      : this.service.listAdvances(user.tenantId, query);
  }

  @Get("advances/my")
  @ApiOperation({ summary: "List current employee's salary advance requests" })
  async listMyAdvances(
    @CurrentUser() user: AuthContext,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const paging = parsePaging(page, pageSize);
    if (!user.tenantId) {
      return paging
        ? { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }
        : [];
    }
    const person = await this.personContext.get(user.tenantId, user.userId);
    if (!person) {
      return paging
        ? { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }
        : [];
    }
    const personId = person.id;
    const query = { personId, search };
    return paging
      ? this.service.listAdvancesPaged(user.tenantId, query, paging)
      : this.service.listAdvances(user.tenantId, query);
  }

  @Get("advances/:id/schedule")
  @ApiOperation({ summary: "Repayment schedule and balance of a salary advance (owner or manager)" })
  async advanceSchedule(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    const canManage = user.permissionKeys.has("payroll.advance.manage");
    const personId = canManage ? undefined : await this.resolvePersonId(user);
    return this.service.getAdvanceSchedule(user.tenantId!, id, { personId, canManage });
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
