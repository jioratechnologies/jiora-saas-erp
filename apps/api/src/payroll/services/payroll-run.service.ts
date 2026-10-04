import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PayrollRunStatus, Prisma } from "@prisma/client";
import { PageParams, toPaged } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import {
  STATUTORY_NOTE,
  computeDayBreakdown,
  computeDayRatePay,
  computePf,
  computePt,
  computeTds,
  dayKey,
  earningsFromSplit,
  isUnpaidLeaveType,
  maskLast4,
  normalizeSplit,
  round2,
  workingDayKeys,
  type DayBreakdown,
} from "./payroll-calc";
import type { ExecutePayrollRunDto, UpdatePayrollRunStatusDto, UpdatePayslipPaymentDto } from "../dto/payroll-run.dto";

const PAYROLL_TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

/** Forward-only payroll run state machine: each state has exactly one successor. */
const NEXT_STATUS: Partial<Record<PayrollRunStatus, PayrollRunStatus>> = {
  DRAFT: PayrollRunStatus.CALCULATED,
  CALCULATED: PayrollRunStatus.APPROVED,
  APPROVED: PayrollRunStatus.DISBURSED,
};

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

  async getRunById(tenantId: string, runId: string, canViewSensitive: boolean) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: { id: runId, tenantId },
        include: {
          payslips: {
            include: {
              person: {
                select: {
                  id: true,
                  firstName: true, middleName: true,
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
      if (canViewSensitive) return run;

      const mask = maskLast4;
      return {
        ...run,
        payslips: run.payslips.map((p) => ({
          ...p,
          person: {
            ...p.person,
            bankAccount: mask(p.person.bankAccount),
            panNumber: mask(p.person.panNumber),
          },
        })),
      };
    });
  }

  async executeRun(tenantId: string, dto: ExecutePayrollRunDto) {
    try {
      return await this.executeRunTx(tenantId, dto);
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictException("A payroll run for this month is already being created. Please try again.");
      }
      throw err;
    }
  }

  /** Month window, working days (Mon-Fri minus holidays) and tenant pay settings. */
  private async monthContext(tx: Prisma.TransactionClient, tenantId: string, year: number, month: number) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59));
    const [holidays, tenant] = await Promise.all([
      tx.holiday.findMany({ where: { tenantId, date: { gte: startDate, lte: endDate } }, select: { date: true } }),
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { workingDaysPerMonth: true, workHoursPerDay: true, salarySplit: true },
      }),
    ]);
    const workingDays = workingDayKeys(year, month, new Set(holidays.map((h) => dayKey(h.date))));
    return {
      year,
      month,
      startDate,
      endDate,
      monthStartKey: dayKey(startDate),
      monthEndKey: dayKey(new Date(Date.UTC(year, month - 1, daysInMonth))),
      workingDays,
      workingDaysPerMonth: tenant?.workingDaysPerMonth && tenant.workingDaysPerMonth > 0 ? tenant.workingDaysPerMonth : 22,
      workHoursPerDay: tenant?.workHoursPerDay && tenant.workHoursPerDay > 0 ? tenant.workHoursPerDay : 8,
      split: normalizeSplit(tenant?.salarySplit),
    };
  }

  /** Day breakdown per person with attendance and leave prefetched in two queries (no N+1). */
  private async computeBreakdowns(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ctx: Awaited<ReturnType<PayrollRunService["monthContext"]>>,
    people: { id: string; joiningDate: Date; exitDate: Date | null }[],
  ): Promise<Map<string, DayBreakdown>> {
    const personIds = people.map((p) => p.id);
    const [attendances, approvedLeaves] = await Promise.all([
      tx.attendance.findMany({
        where: { tenantId, personId: { in: personIds }, date: { gte: ctx.startDate, lte: ctx.endDate } },
        select: { personId: true, status: true, date: true, checkInTime: true, checkOutTime: true },
      }),
      tx.leaveRequest.findMany({
        where: {
          tenantId,
          personId: { in: personIds },
          status: "APPROVED",
          startDate: { lte: ctx.endDate },
          endDate: { gte: ctx.startDate },
        },
        select: { personId: true, startDate: true, endDate: true, leaveType: { select: { name: true, code: true } } },
      }),
    ]);
    const attByPerson = new Map<string, typeof attendances>();
    for (const a of attendances) (attByPerson.get(a.personId) ?? attByPerson.set(a.personId, []).get(a.personId)!).push(a);
    const leavesByPerson = new Map<string, { startDate: Date; endDate: Date; unpaid: boolean }[]>();
    for (const l of approvedLeaves) {
      // Clip to the payroll month
      const span = {
        startDate: l.startDate < ctx.startDate ? ctx.startDate : l.startDate,
        endDate: l.endDate > ctx.endDate ? ctx.endDate : l.endDate,
        unpaid: isUnpaidLeaveType(l.leaveType),
      };
      (leavesByPerson.get(l.personId) ?? leavesByPerson.set(l.personId, []).get(l.personId)!).push(span);
    }
    const out = new Map<string, DayBreakdown>();
    for (const p of people) {
      // Proration uses joiningDate/exitDate only; assignment.effectiveFrom is not a pay-start date.
      const activeStart = p.joiningDate ? [ctx.monthStartKey, dayKey(p.joiningDate)].reduce((a, b) => (a > b ? a : b)) : ctx.monthStartKey;
      const activeEnd = p.exitDate ? [ctx.monthEndKey, dayKey(p.exitDate)].reduce((a, b) => (a < b ? a : b)) : ctx.monthEndKey;
      out.set(
        p.id,
        computeDayBreakdown(
          ctx.workingDays,
          activeStart,
          activeEnd,
          attByPerson.get(p.id) ?? [],
          leavesByPerson.get(p.id) ?? [],
          ctx.workHoursPerDay,
        ),
      );
    }
    return out;
  }

  /** Monthly gross per person: a revision newer than the assignment wins (future-dated revisions excluded). */
  private async baseGrossByPerson(
    tx: Prisma.TransactionClient,
    tenantId: string,
    endDate: Date,
    assignments: { personId: string; baseGross: number; updatedAt: Date }[],
  ): Promise<Map<string, number>> {
    const revisions = await tx.salaryRevision.findMany({
      where: { tenantId, personId: { in: assignments.map((a) => a.personId) }, effectiveDate: { lte: endDate } },
      orderBy: { effectiveDate: "desc" },
    });
    const revisionByPerson = new Map<string, (typeof revisions)[number]>();
    for (const r of revisions) if (!revisionByPerson.has(r.personId)) revisionByPerson.set(r.personId, r);
    const out = new Map<string, number>();
    for (const a of assignments) {
      const rev = revisionByPerson.get(a.personId);
      out.set(a.personId, rev && rev.createdAt > a.updatedAt ? rev.newGross : a.baseGross);
    }
    return out;
  }

  private async executeRunTx(tenantId: string, dto: ExecutePayrollRunDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const { year, month } = dto;
      // Serialize concurrent calculations for the same tenant/month for this transaction.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${tenantId}:${year}-${month}`}))`;

      const ctx = await this.monthContext(tx, tenantId, year, month);
      const { startDate, endDate } = ctx;

      // 1. Get or create PayrollRun header
      let run = await tx.payrollRun.findUnique({
        where: { tenantId_year_month: { tenantId, year, month } },
      });

      if (run && run.status !== PayrollRunStatus.DRAFT && run.status !== PayrollRunStatus.CALCULATED) {
        throw new ConflictException(
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
      const runId = run.id;

      // 2. Fetch active employees, plus those who exited during/after this month
      const employees = await tx.person.findMany({
        where: {
          tenantId,
          personType: "EMPLOYEE",
          OR: [
            { status: { in: ["ACTIVE", "PROBATION", "NOTICE_PERIOD"] } },
            { status: "EXITED", exitDate: { gte: startDate } },
          ],
        },
        include: { salaryAssignment: true },
      });

      const withAssignment = employees.filter((e) => e.salaryAssignment);
      const grossMap = await this.baseGrossByPerson(
        tx,
        tenantId,
        endDate,
        withAssignment.map((e) => ({ personId: e.id, baseGross: e.salaryAssignment!.baseGross, updatedAt: e.salaryAssignment!.updatedAt })),
      );

      const plans = withAssignment.flatMap((emp) => {
        const baseGross = grossMap.get(emp.id) ?? 0;
        if (baseGross <= 0) return []; // Skip employees with no salary configured
        const activeStart = [ctx.monthStartKey, dayKey(emp.joiningDate)].reduce((a, b) => (a > b ? a : b));
        const activeEnd = emp.exitDate ? [ctx.monthEndKey, dayKey(emp.exitDate)].reduce((a, b) => (a < b ? a : b)) : ctx.monthEndKey;
        if (activeStart > activeEnd) return [];
        return [{ emp, baseGross }];
      });
      const personIds = plans.map((p) => p.emp.id);

      // 3. Prefetch attendance, leave, advances, adjustments for all employees in single queries
      const [breakdowns, advances, adjustments] = await Promise.all([
        this.computeBreakdowns(tx, tenantId, ctx, plans.map((p) => p.emp)),
        tx.salaryAdvance.findMany({
          where: { tenantId, personId: { in: personIds }, status: { in: ["APPROVED", "RECOVERING"] } },
          orderBy: { createdAt: "asc" },
        }),
        tx.payrollAdjustment.findMany({
          where: { tenantId, year, month, personId: { in: personIds } },
          orderBy: { createdAt: "asc" },
        }),
      ]);
      const advanceByPerson = new Map<string, (typeof advances)[number]>();
      for (const adv of advances) if (!advanceByPerson.has(adv.personId)) advanceByPerson.set(adv.personId, adv);
      const adjByPerson = new Map<string, typeof adjustments>();
      for (const a of adjustments) (adjByPerson.get(a.personId) ?? adjByPerson.set(a.personId, []).get(a.personId)!).push(a);

      // 4. Process each employee
      for (const { emp, baseGross } of plans) {
        const b = breakdowns.get(emp.id)!;
        const pay = computeDayRatePay(baseGross, ctx.workingDaysPerMonth, b.expectedDays, b.paidDays, ctx.workingDays.length);

        // Earnings from the tenant salary split of earned gross, plus bonus/allowance adjustments
        const earnings: any[] = earningsFromSplit(pay.earnedGross, ctx.split);
        const deductions: any[] = [];
        const myAdjustments = adjByPerson.get(emp.id) ?? [];
        for (const adj of myAdjustments) {
          if (adj.type === "DEDUCTION") continue;
          earnings.push({ code: adj.type, name: adj.reason, amount: round2(adj.amount), adjustmentId: adj.id });
        }

        const grossPay = round2(earnings.reduce((sum, e) => sum + e.amount, 0));
        const basicPay = earnings.find((e) => e.code === "BASIC")?.amount ?? 0;

        // Statutory deductions: placeholder formulas, see payroll-calc.ts
        deductions.push(
          { code: "PF", name: "Provident Fund (Employee)", amount: computePf(basicPay), note: STATUTORY_NOTE },
          { code: "PT", name: "Professional Tax", amount: computePt(baseGross), note: STATUTORY_NOTE },
          { code: "TDS", name: "TDS / Income Tax", amount: computeTds(baseGross), note: STATUTORY_NOTE },
        );
        for (const adj of myAdjustments) {
          if (adj.type === "DEDUCTION") deductions.push({ code: "ADJUSTMENT", name: adj.reason, amount: round2(adj.amount), adjustmentId: adj.id });
        }

        // Salary advance recovery: never deduct more than the net available before the EMI.
        const activeAdvance = advanceByPerson.get(emp.id);
        if (activeAdvance && activeAdvance.monthlyDeduction > 0) {
          const remainingToRecover = (activeAdvance.amountApproved ?? activeAdvance.amountRequested) - activeAdvance.amountRecovered;
          const netBeforeEmi = Math.max(0, grossPay - deductions.reduce((sum, d) => sum + d.amount, 0));
          const advanceEmi = round2(Math.min(activeAdvance.monthlyDeduction, Math.max(0, remainingToRecover), netBeforeEmi));
          if (advanceEmi > 0) {
            // amount is the amount actually deducted; disbursal recovers exactly this.
            deductions.push({ code: "ADVANCE_EMI", name: "Advance EMI", amount: advanceEmi, advanceId: activeAdvance.id });
          }
        }

        const totalDeductions = round2(deductions.reduce((sum, d) => sum + d.amount, 0));
        const netPay = Math.max(0, round2(grossPay - totalDeductions));
        const calcSummary = {
          baseGross,
          expectedDays: b.expectedDays,
          paidDays: b.paidDays,
          unpaidDays: pay.unpaidDays,
          perDayRate: pay.perDayRate,
          lopAmount: pay.lopAmount,
          earnedGross: pay.earnedGross,
          workedHours: b.workedHours,
        };
        const slipData = {
          totalWorkingDays: b.expectedDays,
          presentDays: b.paidDays,
          lopDays: pay.unpaidDays,
          earnings,
          deductions,
          grossPay,
          totalDeductions,
          netPay,
          calcSummary,
        };

        await tx.payslip.upsert({
          where: {
            tenantId_payrollRunId_personId: { tenantId, payrollRunId: runId, personId: emp.id },
          },
          create: { tenantId, payrollRunId: runId, personId: emp.id, year, month, paymentStatus: "PENDING", ...slipData },
          update: slipData,
        });
      }

      // Drop payslips of people no longer eligible, then recompute aggregates from the final payslips.
      await tx.payslip.deleteMany({ where: { tenantId, payrollRunId: runId, personId: { notIn: personIds } } });
      const totals = await tx.payslip.aggregate({
        where: { tenantId, payrollRunId: runId },
        _sum: { grossPay: true, totalDeductions: true, netPay: true },
        _count: { _all: true },
      });

      // Guarded update: only while still DRAFT/CALCULATED.
      const updated = await tx.payrollRun.updateMany({
        where: { id: runId, tenantId, status: { in: [PayrollRunStatus.DRAFT, PayrollRunStatus.CALCULATED] } },
        data: {
          status: PayrollRunStatus.CALCULATED,
          totalGross: round2(totals._sum.grossPay ?? 0),
          totalDeductions: round2(totals._sum.totalDeductions ?? 0),
          totalNet: round2(totals._sum.netPay ?? 0),
          processedStaffCount: totals._count._all,
        },
      });
      if (updated.count !== 1) throw new ConflictException("This payroll run can no longer be re-calculated.");

      return tx.payrollRun.findFirstOrThrow({
        where: { id: runId, tenantId },
        include: { _count: { select: { payslips: true } } },
      });
    }, PAYROLL_TX_OPTIONS);
  }

  /** Per-person attendance and day-rate pay preview for a month. */
  async attendanceSummary(tenantId: string, year: number, month: number, paging: PageParams | null, search?: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const ctx = await this.monthContext(tx, tenantId, year, month);
      const q = search?.trim();
      const where: Prisma.PersonWhereInput = {
        tenantId,
        personType: "EMPLOYEE",
        OR: [{ status: { in: ["ACTIVE", "PROBATION", "NOTICE_PERIOD"] } }, { status: "EXITED", exitDate: { gte: ctx.startDate } }],
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    { firstName: { contains: q, mode: "insensitive" } },
                    { middleName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                  ],
                },
              ],
            }
          : {}),
      };
      const [people, total] = await Promise.all([
        tx.person.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            joiningDate: true,
            exitDate: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
            salaryAssignment: { select: { personId: true, baseGross: true, updatedAt: true } },
          },
          orderBy: [{ firstName: "asc" }, { id: "asc" }],
          ...(paging ? { skip: paging.skip, take: paging.take } : {}),
        }),
        paging ? tx.person.count({ where }) : Promise.resolve(0),
      ]);
      const [breakdowns, grossMap] = await Promise.all([
        this.computeBreakdowns(tx, tenantId, ctx, people),
        this.baseGrossByPerson(
          tx,
          tenantId,
          ctx.endDate,
          people.flatMap((p) => (p.salaryAssignment ? [p.salaryAssignment] : [])),
        ),
      ]);
      const items = people.map((p) => {
        const b = breakdowns.get(p.id)!;
        const pay = computeDayRatePay(grossMap.get(p.id) ?? 0, ctx.workingDaysPerMonth, b.expectedDays, b.paidDays, ctx.workingDays.length);
        return {
          personId: p.id,
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          department: p.department,
          designation: p.designation,
          ...b,
          unpaidDays: pay.unpaidDays,
          expectedHours: round2(b.expectedDays * ctx.workHoursPerDay),
          perDayRate: pay.perDayRate,
          lopAmount: pay.lopAmount,
          earnedGross: pay.earnedGross,
        };
      });
      return paging ? toPaged(items, total, paging) : items;
    }, PAYROLL_TX_OPTIONS);
  }

  /** Final settlement preview for a leaving employee (not persisted). */
  async finalSettlement(tenantId: string, personId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id: personId, tenantId },
        select: { id: true, status: true, joiningDate: true, exitDate: true, salaryAssignment: { select: { personId: true, baseGross: true, updatedAt: true } } },
      });
      if (!person || (!person.exitDate && person.status !== "NOTICE_PERIOD" && person.status !== "EXITED")) {
        throw new NotFoundException("The requested item could not be found.");
      }
      const lastDay = person.exitDate ?? new Date();
      const year = lastDay.getUTCFullYear();
      const month = lastDay.getUTCMonth() + 1;
      const ctx = await this.monthContext(tx, tenantId, year, month);
      const [breakdowns, grossMap, adjustments, advances, claims] = await Promise.all([
        this.computeBreakdowns(tx, tenantId, ctx, [{ id: person.id, joiningDate: person.joiningDate, exitDate: lastDay }]),
        this.baseGrossByPerson(tx, tenantId, ctx.endDate, person.salaryAssignment ? [person.salaryAssignment] : []),
        tx.payrollAdjustment.findMany({ where: { tenantId, personId, year, month } }),
        tx.salaryAdvance.findMany({ where: { tenantId, personId, status: { in: ["APPROVED", "RECOVERING"] } } }),
        tx.expenseClaim.findMany({ where: { tenantId, personId, status: "APPROVED", settledAt: null }, select: { amount: true } }),
      ]);
      const b = breakdowns.get(personId)!;
      const pay = computeDayRatePay(grossMap.get(personId) ?? 0, ctx.workingDaysPerMonth, b.expectedDays, b.paidDays, ctx.workingDays.length);
      const adjustmentsTotal = round2(adjustments.reduce((s, a) => s + (a.type === "DEDUCTION" ? -a.amount : a.amount), 0));
      const outstandingAdvanceBalance = round2(
        advances.reduce((s, a) => s + Math.max(0, (a.amountApproved ?? a.amountRequested) - a.amountRecovered), 0),
      );
      const approvedUnsettledClaimsTotal = round2(claims.reduce((s, c) => s + c.amount, 0));
      return {
        exitDate: person.exitDate,
        lastWorkingMonth: { year, month },
        expectedDays: b.expectedDays,
        paidDays: b.paidDays,
        perDayRate: pay.perDayRate,
        earnedGross: pay.earnedGross,
        adjustmentsTotal,
        outstandingAdvanceBalance,
        approvedUnsettledClaimsTotal,
        estimatedNet: round2(pay.earnedGross + adjustmentsTotal - outstandingAdvanceBalance + approvedUnsettledClaimsTotal),
      };
    }, PAYROLL_TX_OPTIONS);
  }

  async updateStatus(tenantId: string, runId: string, adminUserId: string, dto: UpdatePayrollRunStatusDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const run = await tx.payrollRun.findFirst({ where: { id: runId, tenantId } });
      if (!run) throw new NotFoundException("Payroll run not found.");

      const invalid = () => new ConflictException("This payroll run cannot be moved to that status.");
      if (NEXT_STATUS[run.status] !== dto.status) throw invalid();
      if (dto.status === PayrollRunStatus.CALCULATED && (await tx.payslip.count({ where: { payrollRunId: runId, tenantId } })) === 0) {
        throw invalid();
      }

      const data: Prisma.PayrollRunUpdateManyMutationInput = { status: dto.status };
      if (dto.notes) data.notes = dto.notes;
      if (dto.status === PayrollRunStatus.APPROVED) {
        data.approvedBy = adminUserId;
        data.approvedAt = new Date();
      } else if (dto.status === PayrollRunStatus.DISBURSED) {
        data.disbursedAt = new Date();
      }

      // Atomic claim of the transition; a concurrent or repeated call matches 0 rows.
      const claimed = await tx.payrollRun.updateMany({
        where: { id: runId, tenantId, status: run.status },
        data,
      });
      if (claimed.count !== 1) throw invalid();

      if (dto.status === PayrollRunStatus.DISBURSED) {
        await tx.payslip.updateMany({
          where: { payrollRunId: runId, tenantId },
          data: { paymentStatus: "PAID" },
        });

        // Recover exactly the amount deducted on each payslip (runs once, guarded by the claim above).
        const payslips = await tx.payslip.findMany({ where: { payrollRunId: runId, tenantId }, select: { deductions: true } });
        const emiByAdvance = new Map<string, number>();
        for (const slip of payslips) {
          for (const d of ((slip.deductions as any[]) || [])) {
            if (d.code === "ADVANCE_EMI" && d.advanceId && d.amount > 0) {
              emiByAdvance.set(d.advanceId, (emiByAdvance.get(d.advanceId) ?? 0) + d.amount);
            }
          }
        }
        if (emiByAdvance.size > 0) {
          const advs = await tx.salaryAdvance.findMany({ where: { id: { in: [...emiByAdvance.keys()] }, tenantId } });
          for (const adv of advs) {
            const newRecovered = adv.amountRecovered + (emiByAdvance.get(adv.id) ?? 0);
            const totalTarget = adv.amountApproved ?? adv.amountRequested;
            await tx.salaryAdvance.update({
              where: { id: adv.id },
              data: {
                amountRecovered: newRecovered,
                status: newRecovered >= totalTarget ? "RECOVERED" : "RECOVERING",
              },
            });
          }
        }
      }

      return tx.payrollRun.findFirstOrThrow({
        where: { id: runId, tenantId },
        include: { _count: { select: { payslips: true } } },
      });
    }, PAYROLL_TX_OPTIONS);
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

  async getPayslipById(tenantId: string, payslipId: string, viewer: { personId?: string; isManager: boolean; canViewSensitive?: boolean }) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const slip = await tx.payslip.findFirst({
        where: { id: payslipId, tenantId },
        include: {
          payrollRun: true,
          // Own-view: no bank / IFSC / PAN / salary assignment.
          person: viewer.isManager
            ? { include: { department: true, designation: true, salaryAssignment: true } }
            : {
                select: {
                  id: true,
                  firstName: true, middleName: true,
                  lastName: true,
                  department: { select: { id: true, name: true } },
                  designation: { select: { id: true, name: true } },
                },
              },
        },
      });
      if (!slip || (!viewer.isManager && (!viewer.personId || slip.personId !== viewer.personId))) {
        throw new NotFoundException("The requested item could not be found.");
      }
      if (viewer.isManager && !viewer.canViewSensitive) {
        const { salaryAssignment: _sa, ...rest } = (slip as any).person ?? {};
        return {
          ...slip,
          person: { ...rest, bankAccount: maskLast4(rest.bankAccount), panNumber: maskLast4(rest.panNumber), bankIfsc: undefined },
        };
      }
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

  async getMyPayslipsPaged(tenantId: string, personId: string, paging: PageParams) {
    const where: Prisma.PayslipWhereInput = { tenantId, personId };
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const yearStart = new Date().getFullYear();
      const [items, total, latest, ytd] = await Promise.all([
        tx.payslip.findMany({
          where,
          select: {
            id: true,
            year: true,
            month: true,
            totalWorkingDays: true,
            presentDays: true,
            lopDays: true,
            grossPay: true,
            totalDeductions: true,
            netPay: true,
            paymentStatus: true,
            paymentReference: true,
            createdAt: true,
            payrollRun: { select: { title: true, status: true } },
          },
          orderBy: [{ year: "desc" }, { month: "desc" }, { id: "asc" }],
          skip: paging.skip,
          take: paging.take,
        }),
        tx.payslip.count({ where }),
        tx.payslip.findFirst({
          where,
          select: { netPay: true, year: true, month: true },
          orderBy: [{ year: "desc" }, { month: "desc" }],
        }),
        tx.payslip.aggregate({ where: { ...where, year: yearStart }, _sum: { netPay: true } }),
      ]);
      const stats = {
        count: total,
        latestNet: latest?.netPay ?? null,
        latestPeriod: latest ? { year: latest.year, month: latest.month } : null,
        ytdNet: ytd._sum.netPay ?? 0,
      };
      return { ...toPaged(items, total, paging), stats };
    });
  }
}
