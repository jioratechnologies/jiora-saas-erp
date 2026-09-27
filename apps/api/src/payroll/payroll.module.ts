import { Module } from "@nestjs/common";
import { HrModule } from "../hr/hr.module";
import { SalaryController } from "./controllers/salary.controller";
import { SalaryService } from "./services/salary.service";
import { PayrollRunController } from "./controllers/payroll-run.controller";
import { PayrollRunService } from "./services/payroll-run.service";
import { ClaimsController } from "./controllers/claims.controller";
import { ClaimsService } from "./services/claims.service";

@Module({
  imports: [HrModule],
  controllers: [SalaryController, PayrollRunController, ClaimsController],
  providers: [SalaryService, PayrollRunService, ClaimsService],
  exports: [SalaryService, PayrollRunService, ClaimsService],
})
export class PayrollModule {}
