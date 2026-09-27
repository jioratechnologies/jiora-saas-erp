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
import type { AuthContext } from "../../auth/auth-context";
import { AttendanceService } from "../services/attendance.service";
import { PersonsService } from "../services/persons.service";
import { CheckInDto, CheckOutDto, SyncAttendanceBatchDto, RegularizeAttendanceDto } from "../dto/attendance.dto";

@ApiTags("hr/attendance")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("hr/attendance")
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly personsService: PersonsService,
  ) {}

  private async resolvePersonId(user: AuthContext): Promise<string> {
    const person = await this.personsService.getByUserId(user.tenantId!, user.userId);
    if (!person) {
      throw new NotFoundException("No Employee or Volunteer profile linked to your account yet.");
    }
    return person.id;
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
    const person = await this.personsService.getByUserId(user.tenantId!, user.userId);
    if (!person) return null;
    return this.service.getToday(user.tenantId!, person.id);
  }

  @Get("my-logs")
  @RequirePermission("hr.attendance.checkin")
  @ApiOperation({ summary: "Get current user's personal attendance history" })
  async getMyLogs(@CurrentUser() user: AuthContext) {
    const personId = await this.resolvePersonId(user);
    return this.service.list(user.tenantId!, { personId });
  }

  @Get("roster")
  @RequirePermission("hr.attendance.read")
  @ApiOperation({ summary: "Get daily team attendance roster with leave cross-referencing" })
  async getRoster(@CurrentUser() user: AuthContext, @Query("date") date?: string) {
    return this.service.getRoster(user.tenantId!, date);
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
  list(
    @CurrentUser() user: AuthContext,
    @Query("personId") personId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.service.list(user.tenantId!, { personId, startDate, endDate, departmentId });
  }
}
