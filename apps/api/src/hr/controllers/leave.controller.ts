import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors, Header } from "@nestjs/common";
import { REFERENCE_CACHE_CONTROL } from "../../cache/ref-cache";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LeaveStatus } from "@prisma/client";
import { ZitadelAuthGuard } from "../../auth/zitadel-auth.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { PersonContextService } from "../../auth/person-context.service";
import type { AuthContext } from "../../auth/auth-context";
import { LeaveService } from "../services/leave.service";
import { StorageService } from "../../storage/storage.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { CreateLeaveTypeDto, DecideLeaveRequestDto, SubmitLeaveRequestDto, UpdateLeaveTypeDto } from "../dto/leave.dto";
import { DOCUMENT_UPLOAD } from "../../common/upload-rules";

// No hr.leave.manage permission exists; HR-admin level = hr.person.write.
const HR_ADMIN_PERMISSION = "hr.person.write";

@ApiTags("hr/leave")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("hr/leave")
export class LeaveController {
  constructor(
    private readonly service: LeaveService,
    private readonly personContext: PersonContextService,
    private readonly storage: StorageService,
  ) {}

  @Get("types")
  @RequirePermission("hr.leave.read")
  @ApiOperation({ summary: "List active leave types and quotas" })
  @Header("Cache-Control", REFERENCE_CACHE_CONTROL)
  listTypes(@CurrentUser() user: AuthContext, @Query("includeInactive") includeInactive?: string) {
    // Inactive types are only visible to HR admins managing policies.
    const all = includeInactive === "true" && user.permissionKeys.has(HR_ADMIN_PERMISSION);
    return this.service.listTypes(user.tenantId!, all);
  }

  @Get("balances")
  @RequirePermission("hr.leave.read")
  @ApiOperation({ summary: "Get current user's real-time leave balance ledger" })
  async getBalances(@CurrentUser() user: AuthContext) {
    const person = await this.personContext.get(user.tenantId!, user.userId);
    if (!person) return [];
    return this.service.getBalances(user.tenantId!, person.id);
  }

  @Post("types")
  @RequirePermission(HR_ADMIN_PERMISSION)
  @ApiOperation({ summary: "Create a new leave type" })
  createType(@CurrentUser() user: AuthContext, @Body() dto: CreateLeaveTypeDto) {
    return this.service.createType(user.tenantId!, dto);
  }

  @Patch("types/:id")
  @RequirePermission(HR_ADMIN_PERMISSION)
  @ApiOperation({ summary: "Update or deactivate a leave type" })
  updateType(@CurrentUser() user: AuthContext, @Param("id") id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.service.updateType(user.tenantId!, id, dto);
  }

  @Post("requests/:id/cancel")
  @RequirePermission("hr.leave.apply")
  @ApiOperation({ summary: "Cancel employee's own pending leave request" })
  async cancelRequest(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    const person = await this.personContext.get(user.tenantId!, user.userId);
    if (!person) {
      throw new NotFoundException("No profile linked to your account.");
    }
    return this.service.cancel(user.tenantId!, person.id, id);
  }

  @Post("requests")
  @RequirePermission("hr.leave.apply")
  @ApiOperation({ summary: "Submit a new leave request" })
  async submit(@CurrentUser() user: AuthContext, @Body() dto: SubmitLeaveRequestDto) {
    const person = await this.personContext.get(user.tenantId!, user.userId);
    if (!person) {
      throw new NotFoundException("No Employee or Volunteer profile linked to your account.");
    }
    return this.service.submit(user.tenantId!, person.id, dto, user.permissionKeys.has(HR_ADMIN_PERMISSION));
  }

  @Post("requests/upload-document")
  @UseInterceptors(FileInterceptor("file", DOCUMENT_UPLOAD))
  @RequirePermission("hr.leave.apply")
  @ApiOperation({ summary: "Upload a supporting document for leave request" })
  async uploadSupportingDocument(
    @CurrentUser() user: AuthContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file provided");
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `tenants/${user.tenantId}/leave-docs/${user.userId}-${Date.now()}-${cleanFileName}`;
    await this.storage.uploadFile(fileKey, file.buffer, file.mimetype);
    return {
      name: file.originalname,
      fileKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  @Get("requests/document-url")
  @RequirePermission("hr.leave.read")
  @ApiOperation({ summary: "Get presigned download URL for a leave document" })
  async getDocumentUrl(
    @CurrentUser() user: AuthContext,
    @Query("key") key: string,
  ) {
    if (!key) throw new BadRequestException("File key is required");
    const notFound = "The requested item could not be found.";
    if (!key.startsWith(`tenants/${user.tenantId}/leave-docs/`) || key.includes("..")) {
      throw new NotFoundException(notFound);
    }
    const person = await this.personContext.get(user.tenantId!, user.userId);
    const allowed = await this.service.canAccessDocument(
      user.tenantId!,
      key,
      person?.id,
      user.permissionKeys.has(HR_ADMIN_PERMISSION),
    );
    if (!allowed) throw new NotFoundException(notFound);
    const url = await this.storage.getPresignedUrl(key, 3600);
    return { url };
  }

  @Get("requests")
  @RequirePermission("hr.leave.read")
  @ApiOperation({ summary: "Query leave requests (own history or manager approval queue)" })
  async listRequests(
    @CurrentUser() user: AuthContext,
    @Query("scope") scope: "own" | "approvals" | "all" = "own",
    @Query("status") status?: LeaveStatus,
  ) {
    const person = await this.personContext.get(user.tenantId!, user.userId);

    let personId: string | undefined;
    let approverId: string | undefined;

    if (scope === "all") {
      if (!user.permissionKeys.has(HR_ADMIN_PERMISSION)) {
        throw new ForbiddenException("You do not have permission to perform this action.");
      }
    } else if (scope === "approvals") {
      if (!person) return [];
      approverId = person.id;
    } else {
      if (!person) return [];
      personId = person.id;
    }

    return this.service.listRequests(user.tenantId!, { personId, approverId, status });
  }

  @Patch("requests/:id/approve")
  @RequirePermission("hr.leave.approve")
  @ApiOperation({ summary: "Approve a subordinate leave request" })
  async approve(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    const person = await this.personContext.get(user.tenantId!, user.userId);
    return this.service.decide(user.tenantId!, id, LeaveStatus.APPROVED, dto.decisionNotes, {
      personId: person?.id,
      isHrAdmin: user.permissionKeys.has(HR_ADMIN_PERMISSION),
    });
  }

  @Patch("requests/:id/reject")
  @RequirePermission("hr.leave.approve")
  @ApiOperation({ summary: "Reject a subordinate leave request" })
  async reject(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    const person = await this.personContext.get(user.tenantId!, user.userId);
    return this.service.decide(user.tenantId!, id, LeaveStatus.REJECTED, dto.decisionNotes, {
      personId: person?.id,
      isHrAdmin: user.permissionKeys.has(HR_ADMIN_PERMISSION),
    });
  }
}
