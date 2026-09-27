import { Module } from "@nestjs/common";
import { PersonsService } from "./services/persons.service";
import { PersonsController } from "./controllers/persons.controller";
import { AttendanceService } from "./services/attendance.service";
import { AttendanceController } from "./controllers/attendance.controller";
import { LeaveService } from "./services/leave.service";
import { LeaveController } from "./controllers/leave.controller";
import { HolidaysService } from "./services/holidays.service";
import { HolidaysController } from "./controllers/holidays.controller";

@Module({
  controllers: [PersonsController, AttendanceController, LeaveController, HolidaysController],
  providers: [PersonsService, AttendanceService, LeaveService, HolidaysService],
  exports: [PersonsService, AttendanceService, LeaveService, HolidaysService],
})
export class HrModule {}
