import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../../auth/zitadel-auth.guard";
import { RequirePermission } from "../../auth/require-permission.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { PersonContextService } from "../../auth/person-context.service";
import type { AuthContext } from "../../auth/auth-context";
import { parsePaging } from "../../common/pagination";
import { AttendanceService } from "../services/attendance.service";
import { PersonsService } from "../services/persons.service";
import { CheckInDto, CheckOutDto, SyncAttendanceBatchDto, RegularizeAttendanceDto, ManualAttendanceDto } from "../dto/attendance.dto";

@ApiTags("hr/attendance")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("hr/attendance")
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly personsService: PersonsService,
    private readonly personContext: PersonContextService,
  ) {}

  private async resolvePersonId(user: AuthContext): Promise<string> {
    const personId = await this.personContext.getPersonId(user.tenantId!, user.userId);
    if (!personId) {
      throw new NotFoundException("No Employee or Volunteer profile linked to your account yet.");
    }
    return personId;
  }

  /** undefined = unrestricted (hr.attendance.manage); else own + direct reports. */
  private async visibleScope(user: AuthContext): Promise<string[] | undefined> {
    if (user.permissionKeys.has("hr.attendance.manage")) return undefined;
    const personId = await this.personContext.getPersonId(user.tenantId!, user.userId);
    return this.service.getVisiblePersonIds(user.tenantId!, personId ?? undefined);
  }

  @Get("cloud-time")
  @RequirePermission("hr.attendance.read")
  @ApiOperation({ summary: "Get verified cloud time (IST / configured timezone) from open-source time API" })
  async getCloudTime(@CurrentUser() user: AuthContext, @Query("timezone") timezone?: string) {
    return this.service.getCloudTime(user.tenantId!, timezone);
  }

  @Post("check-in")
  @RequirePermission("hr.attendance.checkin")
  @ApiOperation({ summary: "Submit daily check-in (Office, Remote, or Field)" })
  async checkIn(@CurrentUser() user: AuthContext, @Body() dto: CheckInDto) {
    const personId = await this.resolvePersonId(user);
    return this.service.checkIn(user.tenantId!, personId, dto);
  }

  @Post("check-out")
  @RequirePermission("hr.attendance.checkin")
  @ApiOperation({ summary: "Submit daily check-out" })
  async checkOut(@CurrentUser() user: AuthContext, @Body() dto: CheckOutDto) {
    const personId = await this.resolvePersonId(user);
    return this.service.checkOut(user.tenantId!, personId, dto);
  }

  @Get("today")
  @RequirePermission("hr.attendance.checkin")
  @ApiOperation({ summary: "Get current user's attendance status for today" })
  async getToday(@CurrentUser() user: AuthContext) {
    const personId = await this.personContext.getPersonId(user.tenantId!, user.userId);
    if (!personId) return null;
    return this.service.getToday(user.tenantId!, personId);
  }

  @Get("my-logs")
  @RequirePermission("hr.attendance.checkin")
  @ApiOperation({ summary: "Get current user's personal attendance history" })
  async getMyLogs(
    @CurrentUser() user: AuthContext,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("month") month?: string,
  ) {
    const paging = parsePaging(page, pageSize);
    const personId = user.tenantId ? await this.personContext.getPersonId(user.tenantId, user.userId) : null;
    if (!personId) {
      return paging ? { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 } : [];
    }
    if (paging) return this.service.listMine(user.tenantId!, personId, month, paging);
    return this.service.list(user.tenantId!, { personId });
  }

  @Get("roster")
  @RequirePermission("hr.attendance.read")
  @ApiOperation({ summary: "Get daily team attendance roster with leave cross-referencing" })
  async getRoster(@CurrentUser() user: AuthContext, @Query("date") date?: string) {
    return this.service.getRoster(user.tenantId!, date, await this.visibleScope(user));
  }

  @Post("sync")
  @RequirePermission("hr.attendance.checkin")
  @ApiOperation({ summary: "Batch sync offline attendance records with idempotency" })
  async syncBatch(
    @CurrentUser() user: AuthContext,
    @Body() dto: SyncAttendanceBatchDto,
  ) {
    const personId = await this.resolvePersonId(user);
    return this.service.syncBatch(user.tenantId!, personId, dto);
  }

  @Post("manual")
  @RequirePermission("hr.attendance.manage")
  @ApiOperation({ summary: "Create an attendance record for another person (manager/HR)" })
  async createManual(@CurrentUser() user: AuthContext, @Body() dto: ManualAttendanceDto) {
    const caller = await this.personsService.getByUserId(user.tenantId!, user.userId);
    return this.service.createManual(
      user.tenantId!,
      user.userId,
      caller?.id,
      caller ? `${caller.firstName} ${caller.lastName ?? ""}`.trim() : user.userId,
      dto,
      await this.visibleScope(user),
    );
  }

  @Post(":id/regularize")
  @RequirePermission("hr.attendance.manage")
  @ApiOperation({ summary: "Regularize or adjust an attendance record with reason" })
  async regularize(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: RegularizeAttendanceDto,
  ) {
    return this.service.regularize(user.tenantId!, id, user.userId, dto);
  }

  @Get()
  @RequirePermission("hr.attendance.read")
  @ApiOperation({ summary: "Query attendance logs (by date range, person, or department)" })
  async list(
    @CurrentUser() user: AuthContext,
    @Query("personId") personId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.service.list(
      user.tenantId!,
      { personId, startDate, endDate, departmentId },
      await this.visibleScope(user),
    );
  }
}
