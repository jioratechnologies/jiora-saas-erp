import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { HolidaysService } from "./holidays.service";
import { CreateHolidayDto } from "./dto/holiday.dto";

@ApiTags("hr/holidays")
@ApiBearerAuth()
@UseGuards(ZitadelAuthGuard, PermissionsGuard)
@Controller("hr/holidays")
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  @Get()
  @RequirePermission("hr.holiday.read")
  @ApiOperation({ summary: "List holidays for the active year" })
  list(@CurrentUser() user: AuthContext, @Query("year") year?: number) {
    const y = year ? Number(year) : undefined;
    return this.service.list(user.tenantId!, y);
  }

  @Post()
  @RequirePermission("hr.holiday.write")
  @ApiOperation({ summary: "Add a holiday to the annual calendar" })
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateHolidayDto) {
    return this.service.create(user.tenantId!, dto);
  }

  @Delete(":id")
  @RequirePermission("hr.holiday.write")
  @ApiOperation({ summary: "Delete a holiday" })
  delete(@CurrentUser() user: AuthContext, @Param("id") id: string) {
    return this.service.delete(user.tenantId!, id);
  }
}
