import {
  Body,
  Controller,
  Delete,
  Get,
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
import { PersonStatus, PersonType } from "@prisma/client";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { PersonsService } from "./persons.service";
import { CreatePersonDto, ExitPersonDto, UpdatePersonDto, UploadDocumentDto } from "./dto/person.dto";

@ApiTags("hr/persons")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("hr/persons")
export class PersonsController {
  constructor(private readonly service: PersonsService) {}

  @Get()
  @RequirePermission("hr.person.read")
  @ApiOperation({ summary: "List employees and volunteers with search/filters" })
  list(
    @CurrentUser() user: AuthContext,
    @Query("personType") personType?: PersonType,
    @Query("departmentId") departmentId?: string,
    @Query("status") status?: PersonStatus,
    @Query("search") search?: string,
  ) {
    return this.service.list(user.tenantId!, { personType, departmentId, status, search });
  }

  @Get(":id")
  @RequirePermission("hr.person.read")
  @ApiOperation({ summary: "Get person profile with reporting hierarchy and documents" })
  getById(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.service.getById(user.tenantId!, id);
  }

  @Post()
  @RequirePermission("hr.person.write")
  @ApiOperation({ summary: "Onboard a new employee or volunteer" })
  create(@CurrentUser() user: AuthContext, @Body() dto: CreatePersonDto) {
    return this.service.create(user.tenantId!, dto);
  }

  @Patch(":id")
  @RequirePermission("hr.person.write")
  @ApiOperation({ summary: "Update person profile and reporting hierarchy" })
  update(@CurrentUser() user: AuthContext, @Param("id") id: string, @Body() dto: UpdatePersonDto) {
    return this.service.update(user.tenantId!, id, dto);
  }

  @Patch(":id/exit")
  @RequirePermission("hr.person.exit")
  @ApiOperation({ summary: "Process resignation and exit closure" })
  exit(@CurrentUser() user: AuthContext, @Param("id") id: string, @Body() dto: ExitPersonDto) {
    return this.service.exit(user.tenantId!, id, dto);
  }

  @Post(":id/documents")
  @RequirePermission("hr.person.write")
  @UseInterceptors(FileInterceptor("file"))
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
  getDocumentUrl(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
  ) {
    return this.service.getDocumentUrl(user.tenantId!, id, documentId);
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
