import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ExpenseClaimCategory, ExpenseClaimStatus, Prisma, SalaryAdvanceStatus } from "@prisma/client";
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

      return tx.expenseClaim.create({
        data: {
          tenantId,
          personId,
          title: dto.title.trim(),
          category: dto.category,
          amount: dto.amount,
          expenseDate: new Date(dto.expenseDate),
          description: dto.description?.trim(),
          receiptUrls: (dto.receiptUrls || []) as any,
          status: ExpenseClaimStatus.SUBMITTED,
        },
        include: {
          person: { select: { id: true, firstName: true, lastName: true, department: true, designation: true } },
        },
      });
    });
  }

  async listClaims(
    tenantId: string,
    query?: { personId?: string; status?: ExpenseClaimStatus; category?: ExpenseClaimCategory },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.ExpenseClaimWhereInput = { tenantId };
      if (query?.personId) where.personId = query.personId;
      if (query?.status) where.status = query.status;
      if (query?.category) where.category = query.category;

      return tx.expenseClaim.findMany({
        where,
        include: {
          person: { select: { id: true, firstName: true, lastName: true, department: true, designation: true, email: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async decideClaim(tenantId: string, claimId: string, approverPersonId: string, dto: DecideExpenseClaimDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const claim = await tx.expenseClaim.findFirst({ where: { id: claimId, tenantId } });
      if (!claim) throw new NotFoundException("Claim not found.");

      if (claim.status !== "SUBMITTED") {
        throw new BadRequestException(`Claim is already ${claim.status.toLowerCase()} and cannot be decided.`);
      }

      return tx.expenseClaim.update({
        where: { id: claimId },
        data: {
          status: dto.status as ExpenseClaimStatus,
          approverId: approverPersonId,
          decisionNotes: dto.decisionNotes?.trim(),
          decidedAt: new Date(),
        },
        include: {
          person: { select: { id: true, firstName: true, lastName: true, email: true } },
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
          person: { select: { id: true, firstName: true, lastName: true, department: true, designation: true } },
        },
      });
    });
  }

  async listAdvances(tenantId: string, query?: { personId?: string; status?: SalaryAdvanceStatus }) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.SalaryAdvanceWhereInput = { tenantId };
      if (query?.personId) where.personId = query.personId;
      if (query?.status) where.status = query.status;

      return tx.salaryAdvance.findMany({
        where,
        include: {
          person: { select: { id: true, firstName: true, lastName: true, department: true, designation: true, email: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async decideAdvance(tenantId: string, advanceId: string, approverPersonId: string, dto: DecideSalaryAdvanceDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const advance = await tx.salaryAdvance.findFirst({ where: { id: advanceId, tenantId } });
      if (!advance) throw new NotFoundException("Salary advance request not found.");

      if (advance.status !== "PENDING") {
        throw new BadRequestException(`Advance request is already ${advance.status.toLowerCase()} and cannot be decided.`);
      }

      const amountApproved = dto.status === "APPROVED" ? (dto.amountApproved ?? advance.amountRequested) : null;
      const monthlyDeduction = amountApproved ? Math.round(amountApproved / Math.max(1, advance.tenureMonths)) : 0;

      return tx.salaryAdvance.update({
        where: { id: advanceId },
        data: {
          status: dto.status as SalaryAdvanceStatus,
          amountApproved,
          monthlyDeduction,
          approverId: approverPersonId,
          decisionNotes: dto.decisionNotes?.trim(),
          decidedAt: new Date(),
          disbursedAt: dto.status === "APPROVED" ? new Date() : null,
        },
        include: {
          person: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    });
  }
}
