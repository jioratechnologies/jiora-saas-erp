import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { AttendanceService } from "./attendance.service";
import { PersonsService } from "./persons.service";
import { CheckInDto, CheckOutDto } from "./dto/attendance.dto";

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
