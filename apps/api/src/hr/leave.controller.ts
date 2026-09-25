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
import { LeaveStatus } from "@prisma/client";
import { ZitadelAuthGuard } from "../auth/zitadel-auth.guard";
import { RequirePermission } from "../auth/require-permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/auth-context";
import { LeaveService } from "./leave.service";
import { PersonsService } from "./persons.service";
import { CreateLeaveTypeDto, DecideLeaveRequestDto, SubmitLeaveRequestDto } from "./dto/leave.dto";

@ApiTags("hr/leave")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("hr/leave")
export class LeaveController {
  constructor(
    private readonly service: LeaveService,
    private readonly personsService: PersonsService,
  ) {}

  @Get("types")
  @RequirePermission("hr.leave.read")
  @ApiOperation({ summary: "List active leave types and quotas" })
  listTypes(@CurrentUser() user: AuthContext) {
    return this.service.listTypes(user.tenantId!);
  }

  @Post("types")
  @RequirePermission("hr.holiday.write")
  @ApiOperation({ summary: "Create a new leave type" })
  createType(@CurrentUser() user: AuthContext, @Body() dto: CreateLeaveTypeDto) {
    return this.service.createType(user.tenantId!, dto);
  }

  @Post("requests")
  @RequirePermission("hr.leave.apply")
  @ApiOperation({ summary: "Submit a new leave request" })
  async submit(@CurrentUser() user: AuthContext, @Body() dto: SubmitLeaveRequestDto) {
    const person = await this.personsService.getByUserId(user.tenantId!, user.userId);
    if (!person) {
      throw new NotFoundException("No Employee or Volunteer profile linked to your account.");
    }
    return this.service.submit(user.tenantId!, person.id, dto);
  }

  @Get("requests")
  @RequirePermission("hr.leave.read")
  @ApiOperation({ summary: "Query leave requests (own history or manager approval queue)" })
  async listRequests(
    @CurrentUser() user: AuthContext,
    @Query("scope") scope?: "own" | "approvals" | "all",
    @Query("status") status?: LeaveStatus,
  ) {
    const person = await this.personsService.getByUserId(user.tenantId!, user.userId);

    let personId: string | undefined;
    let approverId: string | undefined;

    if (scope === "own") {
      personId = person?.id;
    } else if (scope === "approvals") {
      approverId = person?.id;
    }

    return this.service.listRequests(user.tenantId!, { personId, approverId, status });
  }

  @Patch("requests/:id/approve")
  @RequirePermission("hr.leave.approve")
  @ApiOperation({ summary: "Approve a subordinate leave request" })
  approve(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.service.decide(user.tenantId!, id, LeaveStatus.APPROVED, dto.decisionNotes);
  }

  @Patch("requests/:id/reject")
  @RequirePermission("hr.leave.approve")
  @ApiOperation({ summary: "Reject a subordinate leave request" })
  reject(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.service.decide(user.tenantId!, id, LeaveStatus.REJECTED, dto.decisionNotes);
  }
}
