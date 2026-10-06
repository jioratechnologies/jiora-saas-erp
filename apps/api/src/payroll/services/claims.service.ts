import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { buildAdvanceSchedule, round2 } from "./payroll-calc";
import { ExpenseClaimCategory, ExpenseClaimStatus, Prisma, SalaryAdvanceStatus } from "@prisma/client";
import { PageParams, toPaged } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  DecideExpenseClaimDto,
  DecideSalaryAdvanceDto,
  RequestSalaryAdvanceDto,
  SettleExpenseClaimDto,
  SubmitExpenseClaimDto,
} from "../dto/claims.dto";

@Injectable()
export class ClaimsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // Expense & Travel Claims
  // ==========================================

  async submitClaim(tenantId: string, personId: string, dto: SubmitExpenseClaimDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({ where: { id: personId, tenantId } });
      if (!person) throw new NotFoundException("Employee profile not found.");

      const keyPrefix = `tenants/${tenantId}/claims/`;
      if ((dto.receiptUrls || []).some((r) => !r.fileKey.startsWith(keyPrefix) || r.fileKey.includes(".."))) {
        throw new BadRequestException("Please check the highlighted fields and try again.");
      }

      return tx.expenseClaim.create({
        data: {
          tenantId,
          personId,
          title: dto.title.trim(),
          category: dto.category,
          amount: dto.amount,
          expenseDate: new Date(dto.expenseDate),
          description: dto.description?.trim(),
          receiptUrls: (dto.receiptUrls || []).map((r) => ({ name: r.name, fileKey: r.fileKey })) as any,
          status: ExpenseClaimStatus.SUBMITTED,
        },
        include: {
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, department: true, designation: true } },
        },
      });
    });
  }

  private claimWhere(
    tenantId: string,
    query?: { personId?: string; status?: ExpenseClaimStatus; category?: ExpenseClaimCategory; search?: string },
  ): Prisma.ExpenseClaimWhereInput {
    const where: Prisma.ExpenseClaimWhereInput = { tenantId };
    if (query?.personId) where.personId = query.personId;
    if (query?.status) where.status = query.status;
    if (query?.category) where.category = query.category;
    const term = query?.search?.trim();
    if (term) {
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { person: { is: { firstName: { contains: term, mode: "insensitive" } } } },
        { person: { is: { lastName: { contains: term, mode: "insensitive" } } } },
      ];
    }
    return where;
  }

  private static readonly CLAIM_INCLUDE = {
    person: { select: { id: true, firstName: true, middleName: true, lastName: true, department: true, designation: true, email: true } },
    approver: { select: { id: true, firstName: true, middleName: true, lastName: true } },
  } satisfies Prisma.ExpenseClaimInclude;

  async listClaims(
    tenantId: string,
    query?: { personId?: string; status?: ExpenseClaimStatus; category?: ExpenseClaimCategory; search?: string },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.expenseClaim.findMany({
        where: this.claimWhere(tenantId, query),
        include: ClaimsService.CLAIM_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async listClaimsPaged(
    tenantId: string,
    query: { personId?: string; status?: ExpenseClaimStatus; category?: ExpenseClaimCategory; search?: string } | undefined,
    paging: PageParams,
  ) {
    const where = this.claimWhere(tenantId, query);
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const [items, total, groups] = await Promise.all([
        tx.expenseClaim.findMany({
          where,
          include: ClaimsService.CLAIM_INCLUDE,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: paging.skip,
          take: paging.take,
        }),
        tx.expenseClaim.count({ where }),
        tx.expenseClaim.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { amount: true } }),
      ]);
      const byStatus = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0, SETTLED: 0 };
      let totalApprovedAmount = 0;
      for (const g of groups) {
        byStatus[g.status] = g._count._all;
        if (g.status === "APPROVED" || g.status === "SETTLED") totalApprovedAmount += g._sum.amount ?? 0;
      }
      return { ...toPaged(items, total, paging), stats: { byStatus, totalApprovedAmount } };
    });
  }

  /** Owner or claim manager only; returns the claim's current receipts. */
  async getClaimForReceipt(tenantId: string, claimId: string, personId: string, isManager: boolean) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id: claimId, tenantId } });
      if (!claim || (!isManager && claim.personId !== personId)) {
        throw new NotFoundException("The requested item could not be found.");
      }
      return claim;
    });
  }

  async addReceipt(tenantId: string, claimId: string, receipt: { name: string; fileKey: string }) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id: claimId, tenantId } });
      if (!claim) throw new NotFoundException("The requested item could not be found.");
      const existing = Array.isArray(claim.receiptUrls) ? (claim.receiptUrls as any[]) : [];
      if (existing.length >= 10) throw new BadRequestException("Please check the highlighted fields and try again.");
      await tx.expenseClaim.update({
        where: { id: claimId },
        data: { receiptUrls: [...existing, receipt] as any },
      });
    });
  }

  async decideClaim(tenantId: string, claimId: string, approverPersonId: string, dto: DecideExpenseClaimDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id: claimId, tenantId } });
      if (!claim) throw new NotFoundException("Claim not found.");

      if (claim.personId === approverPersonId) {
        throw new ForbiddenException("You do not have permission to perform this action.");
      }

      const res = await tx.expenseClaim.updateMany({
        where: { id: claimId, tenantId, status: ExpenseClaimStatus.SUBMITTED },
        data: {
          status: dto.status,
          approverId: approverPersonId,
          decisionNotes: dto.decisionNotes?.trim(),
          decidedAt: new Date(),
        },
      });
      if (res.count === 0) throw new ConflictException("This request was already processed.");

      return tx.expenseClaim.findFirstOrThrow({
        where: { id: claimId, tenantId },
        include: {
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true } },
        },
      });
    });
  }

  async settleClaim(tenantId: string, claimId: string, dto: SettleExpenseClaimDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id: claimId, tenantId } });
      if (!claim) throw new NotFoundException("Claim not found.");

      if (claim.status !== "APPROVED") {
        throw new BadRequestException("Only approved claims can be marked as settled / reimbursed.");
      }

      return tx.expenseClaim.update({
        where: { id: claimId },
        data: {
          status: ExpenseClaimStatus.SETTLED,
          settledAt: new Date(),
          settlementReference: dto.settlementReference.trim(),
        },
      });
    });
  }

  // ==========================================
  // Emergency Salary Advances
  // ==========================================

  async requestAdvance(tenantId: string, personId: string, dto: RequestSalaryAdvanceDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id: personId, tenantId },
        include: { salaryAssignment: true },
      });
      if (!person) throw new NotFoundException("Employee not found.");

      if (person.personType === "VOLUNTEER") {
        throw new BadRequestException("Volunteers cannot request salary advances as they do not receive a salary.");
      }

      // Check if employee already has an unrecovered advance
      const existing = await tx.salaryAdvance.findFirst({
        where: {
          tenantId,
          personId,
          status: { in: ["PENDING", "APPROVED", "RECOVERING"] },
        },
      });
      if (existing) {
        throw new BadRequestException(
          `You already have an active advance (${existing.status.toLowerCase()}). Please complete or resolve it first.`,
        );
      }

      const monthlyDeduction = Math.round(dto.amountRequested / Math.max(1, dto.tenureMonths));

      return tx.salaryAdvance.create({
        data: {
          tenantId,
          personId,
          amountRequested: dto.amountRequested,
          reason: dto.reason.trim(),
          tenureMonths: dto.tenureMonths,
          monthlyDeduction,
          status: SalaryAdvanceStatus.PENDING,
        },
        include: {
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, department: true, designation: true } },
        },
      });
    });
  }

  private advanceWhere(
    tenantId: string,
    query?: { personId?: string; status?: SalaryAdvanceStatus; search?: string },
  ): Prisma.SalaryAdvanceWhereInput {
    const where: Prisma.SalaryAdvanceWhereInput = { tenantId };
    if (query?.personId) where.personId = query.personId;
    if (query?.status) where.status = query.status;
    const term = query?.search?.trim();
    if (term) {
      where.OR = [
        { reason: { contains: term, mode: "insensitive" } },
        { person: { is: { firstName: { contains: term, mode: "insensitive" } } } },
        { person: { is: { lastName: { contains: term, mode: "insensitive" } } } },
      ];
    }
    return where;
  }

  private static readonly ADVANCE_INCLUDE = {
    person: { select: { id: true, firstName: true, middleName: true, lastName: true, department: true, designation: true, email: true } },
    approver: { select: { id: true, firstName: true, middleName: true, lastName: true } },
  } satisfies Prisma.SalaryAdvanceInclude;

  async listAdvances(tenantId: string, query?: { personId?: string; status?: SalaryAdvanceStatus; search?: string }) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      return tx.salaryAdvance.findMany({
        where: this.advanceWhere(tenantId, query),
        include: ClaimsService.ADVANCE_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async listAdvancesPaged(
    tenantId: string,
    query: { personId?: string; status?: SalaryAdvanceStatus; search?: string } | undefined,
    paging: PageParams,
  ) {
    const where = this.advanceWhere(tenantId, query);
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const [items, total, groups, open] = await Promise.all([
        tx.salaryAdvance.findMany({
          where,
          include: ClaimsService.ADVANCE_INCLUDE,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: paging.skip,
          take: paging.take,
        }),
        tx.salaryAdvance.count({ where }),
        tx.salaryAdvance.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),
        tx.salaryAdvance.findMany({
          where: { AND: [where, { status: { in: ["APPROVED", "RECOVERING"] } }] },
          select: { amountApproved: true, totalInterest: true, amountRecovered: true },
        }),
      ]);
      const byStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0, RECOVERING: 0, RECOVERED: 0 };
      for (const g of groups) byStatus[g.status] = g._count._all;
      // Per advance so an over-recovered one cannot offset another's balance.
      const outstandingAmount = open.reduce(
        (sum, a) => sum + Math.max(0, (a.amountApproved ?? 0) + (a.totalInterest ?? 0) - (a.amountRecovered ?? 0)),
        0,
      );
      return { ...toPaged(items, total, paging), stats: { byStatus, outstandingAmount } };
    });
  }

  async decideAdvance(tenantId: string, advanceId: string, approverPersonId: string, dto: DecideSalaryAdvanceDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const advance = await tx.salaryAdvance.findFirst({ where: { id: advanceId, tenantId } });
      if (!advance) throw new NotFoundException("Salary advance request not found.");

      if (advance.personId === approverPersonId) {
        throw new ForbiddenException("You do not have permission to perform this action.");
      }

      const amountApproved = dto.status === "APPROVED" ? (dto.amountApproved ?? advance.amountRequested) : null;
      const tenure = dto.tenureMonths ?? advance.tenureMonths;
      const interestRate = dto.status === "APPROVED" ? (dto.interestRate ?? 0) : 0;

      // First instalment falls due next month; schedule is fixed at approval.
      const now = new Date();
      const startIdx = now.getUTCMonth() + 1;
      const schedule = amountApproved
        ? buildAdvanceSchedule(amountApproved, interestRate, tenure, now.getUTCFullYear() + Math.floor(startIdx / 12), (startIdx % 12) + 1)
        : [];
      const totalInterest = round2(schedule.reduce((sum, i) => sum + i.interest, 0));
      const monthlyDeduction = schedule[0]?.emi ?? 0;

      const res = await tx.salaryAdvance.updateMany({
        where: { id: advanceId, tenantId, status: SalaryAdvanceStatus.PENDING },
        data: {
          status: dto.status,
          amountApproved,
          tenureMonths: tenure,
          interestRate,
          totalInterest,
          monthlyDeduction,
          approverId: approverPersonId,
          decisionNotes: dto.decisionNotes?.trim(),
          decidedAt: new Date(),
          disbursedAt: dto.status === "APPROVED" ? new Date() : null,
        },
      });
      if (res.count === 0) throw new ConflictException("This request was already processed.");

      if (schedule.length > 0) {
        await tx.advanceInstalment.createMany({
          data: schedule.map((i) => ({ ...i, tenantId, advanceId })),
        });
      }

      return tx.salaryAdvance.findFirstOrThrow({
        where: { id: advanceId, tenantId },
        include: {
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true } },
        },
      });
    });
  }

  /** Full repayment ledger for one advance: summary plus every instalment. */
  async getAdvanceSchedule(tenantId: string, advanceId: string, viewer: { personId?: string; canManage: boolean }) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const advance = await tx.salaryAdvance.findFirst({
        where: { id: advanceId, tenantId },
        include: {
          person: { select: { id: true, firstName: true, middleName: true, lastName: true, email: true } },
          instalments: { orderBy: { number: "asc" } },
        },
      });
      if (!advance) throw new NotFoundException("The requested item could not be found.");
      if (!viewer.canManage && advance.personId !== viewer.personId) {
        throw new ForbiddenException("You do not have permission to perform this action.");
      }
      const principal = advance.amountApproved ?? advance.amountRequested;
      const totalPayable = round2(principal + advance.totalInterest);
      return {
        ...advance,
        principal,
        totalPayable,
        balance: round2(Math.max(0, totalPayable - advance.amountRecovered)),
      };
    });
  }
}
