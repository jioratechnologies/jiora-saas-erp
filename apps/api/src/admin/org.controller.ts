import { BadRequestException, Body, Controller, Get, Patch, Post, UploadedFile, UseGuards, UseInterceptors, Header } from "@nestjs/common";
import { REFERENCE_CACHE_CONTROL } from "../cache/ref-cache";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { TenantsService } from "../tenants/tenants.service";
import { UpdateTenantThemeDto } from "../tenants/dto";
import { UpdateWorkScheduleDto } from "./dto";
import { StorageService } from "../storage/storage.service";
import { IMAGE_UPLOAD } from "../common/upload-rules";

/** The tenant's own organisation profile — name, theme, branding. Not platform tenant CRUD (see tenants.controller.ts). */
@ApiTags("admin: organisation")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("admin/org")
export class OrgController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Any authenticated tenant user can read their organisation's branding and profile.
   * Updating theme still strictly requires admin.org.write. Platform staff (no
   * tenantId — isPlatformContext) have no "own org" concept; the frontend
   * doesn't call this for them, but return null rather than crash on the
   * off chance something else does.
   */
  @Get()
  @Header("Cache-Control", REFERENCE_CACHE_CONTROL)
  get(@CurrentUser() user: AuthContext) {
    if (!user.tenantId) return null;
    return this.tenants.getOwn(user.tenantId);
  }

  @Patch("theme")
  @RequirePermission("admin.org.write")
  updateTheme(@CurrentUser() user: AuthContext, @Body() dto: UpdateTenantThemeDto) {
    return this.tenants.updateTheme(user.tenantId!, dto);
  }

  @Patch("work-schedule")
  @RequirePermission("admin.org.write")
  updateWorkSchedule(@CurrentUser() user: AuthContext, @Body() dto: UpdateWorkScheduleDto) {
    const { basic, hra, other } = dto.salarySplit;
    if (basic + hra + other !== 100) throw new BadRequestException("Salary split must add up to 100%.");
    if (Math.round(dto.workHoursPerDay * 2) !== dto.workHoursPerDay * 2) {
      throw new BadRequestException("Hours per day must be in steps of 0.5.");
    }
    return this.tenants.updateWorkSchedule(user.tenantId!, dto);
  }

  @Post("logo")
  @RequirePermission("admin.org.write")
  @UseInterceptors(FileInterceptor("file", IMAGE_UPLOAD))
  @ApiOperation({ summary: "Upload and update organisation logo" })
  async uploadLogo(
    @CurrentUser() user: AuthContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No image file provided");
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `tenants/${user.tenantId}/branding/logo-${Date.now()}-${cleanFileName}`;

    await this.storage.uploadFile(fileKey, file.buffer, file.mimetype);
    const logoUrl = await this.storage.getPresignedUrl(fileKey, 604800); // 7 days

    await this.tenants.updateTheme(user.tenantId!, { logoUrl });
    return { logoUrl, fileKey };
  }
}
