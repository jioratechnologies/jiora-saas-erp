import {
  BadRequestException,
  Body,
  ForbiddenException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PersonStatus, PersonType } from "@prisma/client";
import { ZitadelAuthGuard } from "../../auth/zitadel-auth.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { PersonContextService } from "../../auth/person-context.service";
import type { AuthContext } from "../../auth/auth-context";
import { parsePaging } from "../../common/pagination";
import { PersonsService } from "../services/persons.service";
import { CreatePersonDto, ExitPersonDto, ReviewDocumentDto, UpdatePersonDto, UploadDocumentDto, BulkImportPersonsDto, UpdateExitChecklistDto } from "../dto/person.dto";
import { DOCUMENT_UPLOAD } from "../../common/upload-rules";

const callerOf = (user: AuthContext) => ({
  userId: user.userId,
  permissionKeys: user.permissionKeys,
  isPlatform: user.isPlatformContext,
});

const DIRECTORY_FIELDS = [
  "id",
  "firstName",
  "middleName",
  "lastName",
  "email",
  "personType",
  "status",
  "avatarUrl",
  "departmentId",
  "designationId",
  "department",
  "designation",
] as const;

function toDirectoryEntry(p: any) {
  const out: Record<string, unknown> = {};
  for (const k of DIRECTORY_FIELDS) out[k] = p[k];
  return out;
}

@ApiTags("hr/persons")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("hr/persons")
export class PersonsController {
  constructor(
    private readonly service: PersonsService,
    private readonly personContext: PersonContextService,
  ) {}

  @Get()
  @RequirePermission("hr.person.read")
  @ApiOperation({ summary: "List employees and volunteers with search/filters" })
  async list(
    @CurrentUser() user: AuthContext,
    @Query("personType") personType?: PersonType,
    @Query("departmentId") departmentId?: string,
    @Query("status") status?: PersonStatus,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const paging = parsePaging(page, pageSize);
    if (paging) {
      const res = await this.service.listPaged(user.tenantId!, { personType, departmentId, status, search }, paging);
      if (user.permissionKeys.has("hr.person.write")) return res;
      // Directory readers never see reporting lines.
      return { ...res, items: res.items.map(({ manager: _manager, ...rest }) => rest) };
    }
    const rows = await this.service.list(user.tenantId!, { personType, departmentId, status, search });
    if (user.permissionKeys.has("hr.person.write")) return rows;
    const self = await this.personContext.get(user.tenantId!, user.userId);
    return rows.map((p) => (self && p.id === self.id ? p : toDirectoryEntry(p)));
  }

  @Get(":id")
  @RequirePermission("hr.person.read")
  @ApiOperation({ summary: "Get person profile with reporting hierarchy and documents" })
  async getById(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    const person = await this.service.getById(user.tenantId!, id);
    if (user.permissionKeys.has("hr.person.write")) return person;
    const self = await this.personContext.get(user.tenantId!, user.userId);
    if (self && self.id === id) return person;
    return toDirectoryEntry(person);
  }

  @Post("bulk-import")
  @RequirePermission("hr.person.write")
  @ApiOperation({ summary: "Bulk import employees or volunteers from CSV" })
  bulkImport(@CurrentUser() user: AuthContext, @Body() dto: BulkImportPersonsDto) {
    return this.service.bulkImport(user.tenantId!, dto, callerOf(user));
  }

  @Post()
  @RequirePermission("hr.person.write")
  @ApiOperation({ summary: "Onboard a new employee or volunteer" })
  create(@CurrentUser() user: AuthContext, @Body() dto: CreatePersonDto) {
    return this.service.create(user.tenantId!, dto, callerOf(user));
  }

  @Patch(":id")
  @RequirePermission("hr.person.write")
  @ApiOperation({ summary: "Update person profile and reporting hierarchy" })
  update(@CurrentUser() user: AuthContext, @Param("id") id: string, @Body() dto: UpdatePersonDto) {
    return this.service.update(user.tenantId!, id, dto, callerOf(user));
  }

  @Patch(":id/exit-checklist")
  @RequirePermission("hr.person.exit")
  @ApiOperation({ summary: "Update exit clearance checklist and finalize closure" })
  updateExitChecklist(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: UpdateExitChecklistDto,
  ) {
    return this.service.updateExitChecklist(user.tenantId!, id, dto);
  }

  @Patch(":id/exit")
  @RequirePermission("hr.person.exit")
  @ApiOperation({ summary: "Process resignation and exit closure" })
  exit(@CurrentUser() user: AuthContext, @Param("id") id: string, @Body() dto: ExitPersonDto) {
    return this.service.exit(user.tenantId!, id, dto);
  }

  @Post(":id/documents")
  @RequirePermission("hr.person.write")
  @UseInterceptors(FileInterceptor("file", DOCUMENT_UPLOAD))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload employee document (KYC, Resume, Contract) to MinIO" })
  uploadDocument(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadDocument(user.tenantId!, id, dto, {
      originalname: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  @Get(":id/documents/:documentId/url")
  @RequirePermission("hr.person.read")
  @ApiOperation({ summary: "Generate secure presigned download URL for a document" })
  async getDocumentUrl(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
  ) {
    if (!user.permissionKeys.has("hr.person.write")) {
      const self = await this.personContext.get(user.tenantId!, user.userId);
      if (!self || self.id !== id) {
        throw new ForbiddenException("You do not have permission to perform this action.");
      }
    }
    return this.service.getDocumentUrl(user.tenantId!, id, documentId);
  }

  @Get(":id/documents/:documentId/content")
  @RequirePermission("hr.person.read")
  @ApiOperation({ summary: "Stream a PDF document's bytes for in-app preview" })
  async getDocumentContent(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
  ) {
    if (!user.permissionKeys.has("hr.person.write")) {
      const self = await this.personContext.get(user.tenantId!, user.userId);
      if (!self || self.id !== id) {
        throw new ForbiddenException("You do not have permission to perform this action.");
      }
    }
    const { buffer, mimeType } = await this.service.getDocumentContent(user.tenantId!, id, documentId);
    if (mimeType !== "application/pdf") {
      throw new BadRequestException("Preview is only available for PDF documents.");
    }
    return new StreamableFile(buffer, { type: "application/pdf", disposition: "inline" });
  }

  @Patch(":id/documents/:documentId/review")
  @RequirePermission("hr.person.write")
  @ApiOperation({ summary: "Review KYC or compliance document (Approve or Reject)" })
  reviewDocument(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.service.reviewDocument(user.tenantId!, id, documentId, user.userId, dto);
  }

  @Delete(":id/documents/:documentId")
  @RequirePermission("hr.person.write")
  @ApiOperation({ summary: "Delete a document" })
  deleteDocument(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
  ) {
    return this.service.deleteDocument(user.tenantId!, id, documentId);
  }
}
