import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatePayrollAdjustmentDto } from "../dto/payroll-adjustment.dto";

const LOCKED_MSG = "This month's payroll has already been approved, so adjustments can no longer be changed.";

@Injectable()
export class PayrollAdjustmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMonthOpen(tx: Prisma.TransactionClient, tenantId: string, year: number, month: number) {
    const locked = await tx.payrollRun.findFirst({
      where: { tenantId, year, month, status: { in: ["APPROVED", "DISBURSED"] } },
      select: { id: true },
    });
    if (locked) throw new ConflictException(LOCKED_MSG);
  }

  async create(tenantId: string, createdBy: string, dto: CreatePayrollAdjustmentDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({ where: { id: dto.personId, tenantId }, select: { id: true } });
      if (!person) throw new NotFoundException("The requested item could not be found.");
      await this.assertMonthOpen(tx, tenantId, dto.year, dto.month);
      return tx.payrollAdjustment.create({
        data: {
          tenantId,
          personId: dto.personId,
          year: dto.year,
          month: dto.month,
          type: dto.type,
          amount: dto.amount,
          reason: dto.reason.trim(),
          createdBy,
        },
      });
    });
  }

  /** True when the month already has a calculated (not yet approved) run whose payslips need refreshing. */
  async hasEditableRun(tenantId: string, year: number, month: number) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: { tenantId, year, month, status: { in: ["DRAFT", "CALCULATED"] } },
        select: { id: true },
      });
      return Boolean(run);
    });
  }

  async list(tenantId: string, filter: { year?: number; month?: number; personId?: string }) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.PayrollAdjustmentWhereInput = { tenantId };
      if (filter.year) where.year = filter.year;
      if (filter.month) where.month = filter.month;
      if (filter.personId) where.personId = filter.personId;
      return tx.payrollAdjustment.findMany({
        where,
        include: { person: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const adj = await tx.payrollAdjustment.findFirst({ where: { id, tenantId } });
      if (!adj) throw new NotFoundException("The requested item could not be found.");
      await this.assertMonthOpen(tx, tenantId, adj.year, adj.month);
      await tx.payrollAdjustment.deleteMany({ where: { id, tenantId } });
      return { id, year: adj.year, month: adj.month };
    });
  }
}
