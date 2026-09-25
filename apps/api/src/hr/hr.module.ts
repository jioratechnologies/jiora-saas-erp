import { Module } from "@nestjs/common";
import { PersonsService } from "./persons.service";
import { PersonsController } from "./persons.controller";
import { AttendanceService } from "./attendance.service";
import { AttendanceController } from "./attendance.controller";
import { LeaveService } from "./leave.service";
import { LeaveController } from "./leave.controller";
import { HolidaysService } from "./holidays.service";
import { HolidaysController } from "./holidays.controller";

@Module({
  controllers: [PersonsController, AttendanceController, LeaveController, HolidaysController],
  providers: [PersonsService, AttendanceService, LeaveService, HolidaysService],
  exports: [PersonsService, AttendanceService, LeaveService, HolidaysService],
})
export class HrModule {}
