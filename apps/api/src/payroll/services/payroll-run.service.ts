import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PayrollRunStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { ExecutePayrollRunDto, UpdatePayrollRunStatusDto, UpdatePayslipPaymentDto } from "../dto/payroll-run.dto";

@Injectable()
export class PayrollRunService {
  constructor(private readonly prisma: PrismaService) {}

  async listRuns(tenantId: string, year?: number) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.PayrollRunWhereInput = { tenantId };
      if (year) where.year = year;

      return tx.payrollRun.findMany({
        where,
        include: { _count: { select: { payslips: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });
    });
  }

  async getRunById(tenantId: string, runId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: { id: runId, tenantId },
        include: {
          payslips: {
            include: {
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true,
                  designation: true,
                  bankAccount: true,
                  bankIfsc: true,
                  panNumber: true,
                },
              },
            },
            orderBy: { person: { firstName: "asc" } },
          },
        },
      });
      if (!run) throw new NotFoundException("Payroll run not found.");
      return run;
    });
  }

  async executeRun(tenantId: string, dto: ExecutePayrollRunDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const { year, month } = dto;
      const daysInMonth = new Date(year, month, 0).getDate();
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59));

      // Calculate total working days in the month (Mon-Fri weekdays)
      let totalWorkingDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(Date.UTC(year, month - 1, day));
        const dayOfWeek = d.getUTCDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          totalWorkingDays++;
        }
      }

      // 1. Get or create PayrollRun header
      let run = await tx.payrollRun.findUnique({
        where: { tenantId_year_month: { tenantId, year, month } },
      });

      if (run && (run.status === "APPROVED" || run.status === "DISBURSED")) {
        throw new BadRequestException(
          `Payroll run for ${month}/${year} is already ${run.status.toLowerCase()} and cannot be re-calculated.`,
        );
      }

      const title = dto.title || `${new Date(year, month - 1).toLocaleString("en-US", { month: "long" })} ${year} Payroll`;

      if (!run) {
        run = await tx.payrollRun.create({
          data: {
            tenantId,
            year,
            month,
            title,
            status: PayrollRunStatus.DRAFT,
            notes: dto.notes,
          },
        });
      }

      // 2. Fetch all active employees
      const employees = await tx.person.findMany({
        where: {
          tenantId,
          personType: "EMPLOYEE",
          status: { in: ["ACTIVE", "PROBATION", "NOTICE_PERIOD"] },
        },
        include: {
          salaryAssignment: { include: { salaryStructure: true } },
          department: true,
          designation: true,
        },
      });

      let totalGrossAll = 0;
      let totalDeductionsAll = 0;
      let totalNetAll = 0;
      let staffProcessed = 0;

      // 3. Process each employee
      for (const emp of employees) {
        const assignment = emp.salaryAssignment;
        const baseGross = assignment?.baseGross ?? 0;
        if (baseGross <= 0) continue; // Skip employees with no salary configured

        // 3a. Attendance analysis for LOP
        const attendances = await tx.attendance.findMany({
          where: {
            tenantId,
            personId: emp.id,
            date: { gte: startDate, lte: endDate },
          },
        });

        const approvedLeaves = await tx.leaveRequest.findMany({
          where: {
            tenantId,
            personId: emp.id,
            status: "APPROVED",
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        });

        // Calculate days present / covered
        let presentDays = 0;
        for (const att of attendances) {
          if (att.status === "PRESENT" || att.status === "ON_LEAVE") presentDays += 1;
          else if (att.status === "HALF_DAY") presentDays += 0.5;
        }

        // Add approved leave days count in this month
        let leaveDaysInMonth = 0;
        for (const lv of approvedLeaves) {
          leaveDaysInMonth += lv.daysCount;
        }

        const effectiveDays = Math.min(totalWorkingDays, presentDays + leaveDaysInMonth);
        // Derive LOP (loss of pay) based on actual working days in the month
        const lopDays = Math.max(0, totalWorkingDays - effectiveDays);
        const payableDays = Math.max(0, totalWorkingDays - lopDays);
        const attendanceFactor = totalWorkingDays > 0 ? payableDays / totalWorkingDays : 1;

        // 3b. Breakdown earnings
        const basicPay = Math.round(baseGross * 0.5 * attendanceFactor);
        const hra = Math.round(baseGross * 0.25 * attendanceFactor);
        const conveyance = Math.round(baseGross * 0.1 * attendanceFactor);
        const specialAllowance = Math.max(0, Math.round(baseGross * attendanceFactor) - (basicPay + hra + conveyance));

        const earnings: any[] = [
          { code: "BASIC", name: "Basic Salary", amount: basicPay },
          { code: "HRA", name: "House Rent Allowance", amount: hra },
          { code: "CONVEYANCE", name: "Conveyance Allowance", amount: conveyance },
          { code: "SPECIAL", name: "Special Allowance", amount: specialAllowance },
        ];

        const grossPay = basicPay + hra + conveyance + specialAllowance;

        // 3c. Calculate deductions
        const pf = Math.round(basicPay * 0.12); // Standard 12% PF on Basic
        const pt = baseGross > 20000 ? 200 : 0; // Professional tax
        const tds = baseGross > 50000 ? Math.round(baseGross * 0.05) : 0; // 5% TDS threshold

        const deductions: any[] = [
          { code: "PF", name: "Provident Fund (Employee)", amount: pf },
          { code: "PT", name: "Professional Tax", amount: pt },
          { code: "TDS", name: "TDS / Income Tax", amount: tds },
        ];

        // 3d. Check for active salary advance recovery
        const activeAdvance = await tx.salaryAdvance.findFirst({
          where: {
            tenantId,
            personId: emp.id,
            status: { in: ["APPROVED", "RECOVERING"] },
          },
          orderBy: { createdAt: "asc" },
        });

        if (activeAdvance && activeAdvance.monthlyDeduction > 0) {
          const remainingToRecover = (activeAdvance.amountApproved ?? activeAdvance.amountRequested) - activeAdvance.amountRecovered;
          const advanceEmi = Math.min(activeAdvance.monthlyDeduction, Math.max(0, remainingToRecover));
          if (advanceEmi > 0) {
            deductions.push({
              code: "ADVANCE_EMI",
              name: `Salary Advance Recovery (${activeAdvance.reason.substring(0, 20)})`,
              amount: advanceEmi,
              advanceId: activeAdvance.id,
            });
          }
        }

        const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
        const netPay = Math.max(0, grossPay - totalDeductions);

        // 3e. Upsert Payslip
        await tx.payslip.upsert({
          where: {
            tenantId_payrollRunId_personId: {
              tenantId,
              payrollRunId: run.id,
              personId: emp.id,
            },
          },
          create: {
            tenantId,
            payrollRunId: run.id,
            personId: emp.id,
            year,
            month,
            totalWorkingDays,
            presentDays: effectiveDays,
            lopDays,
            earnings,
            deductions,
            grossPay,
            totalDeductions,
            netPay,
            paymentStatus: "PENDING",
          },
          update: {
            totalWorkingDays,
            presentDays: effectiveDays,
            lopDays,
            earnings,
            deductions,
            grossPay,
            totalDeductions,
            netPay,
          },
        });

        totalGrossAll += grossPay;
        totalDeductionsAll += totalDeductions;
        totalNetAll += netPay;
        staffProcessed++;
      }

      // 4. Update PayrollRun aggregate numbers
      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.CALCULATED,
          totalGross: totalGrossAll,
          totalDeductions: totalDeductionsAll,
          totalNet: totalNetAll,
          processedStaffCount: staffProcessed,
        },
        include: { _count: { select: { payslips: true } } },
      });
    });
  }

  async updateStatus(tenantId: string, runId: string, adminUserId: string, dto: UpdatePayrollRunStatusDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: { id: runId, tenantId },
        include: { payslips: true },
      });
      if (!run) throw new NotFoundException("Payroll run not found.");

      const updateData: any = { status: dto.status };
      if (dto.notes) updateData.notes = dto.notes;

      if (dto.status === "APPROVED") {
        updateData.approvedBy = adminUserId;
        updateData.approvedAt = new Date();
      } else if (dto.status === "DISBURSED") {
        updateData.disbursedAt = new Date();
        // Mark all payslips as PAID and process advance EMI recoveries
        await tx.payslip.updateMany({
          where: { payrollRunId: runId, tenantId },
          data: { paymentStatus: "PAID" },
        });

        // Deduct advance recoveries
        for (const slip of run.payslips) {
          const deductions = (slip.deductions as any[]) || [];
          for (const d of deductions) {
            if (d.code === "ADVANCE_EMI" && d.advanceId) {
              const adv = await tx.salaryAdvance.findUnique({ where: { id: d.advanceId } });
              if (adv) {
                const newRecovered = adv.amountRecovered + d.amount;
                const totalTarget = adv.amountApproved ?? adv.amountRequested;
                const isFullyRecovered = newRecovered >= totalTarget;
                await tx.salaryAdvance.update({
                  where: { id: d.advanceId },
                  data: {
                    amountRecovered: newRecovered,
                    status: isFullyRecovered ? "RECOVERED" : "RECOVERING",
                  },
                });
              }
            }
          }
        }
      }

      return tx.payrollRun.update({
        where: { id: runId },
        data: updateData,
        include: { _count: { select: { payslips: true } } },
      });
    });
  }

  async updatePayslipPayment(tenantId: string, payslipId: string, dto: UpdatePayslipPaymentDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const payslip = await tx.payslip.findFirst({ where: { id: payslipId, tenantId } });
      if (!payslip) throw new NotFoundException("Payslip not found.");

      return tx.payslip.update({
        where: { id: payslipId },
        data: {
          paymentStatus: dto.paymentStatus,
          paymentReference: dto.paymentReference,
        },
      });
    });
  }

  async getPayslipById(tenantId: string, payslipId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const slip = await tx.payslip.findFirst({
        where: { id: payslipId, tenantId },
        include: {
          payrollRun: true,
          person: {
            include: {
              department: true,
              designation: true,
              salaryAssignment: true,
            },
          },
        },
      });
      if (!slip) throw new NotFoundException("Payslip not found.");
      return slip;
    });
  }

  async getMyPayslips(tenantId: string, personId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.payslip.findMany({
        where: { tenantId, personId },
        include: { payrollRun: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });
    });
  }
}
