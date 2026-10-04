import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LeaveApplicability, LeaveStatus, PersonType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../cache/cache.service";
import { cachedRef, invalidateRef } from "../../cache/ref-cache";
import type { CreateLeaveTypeDto, SubmitLeaveRequestDto, UpdateLeaveTypeDto } from "../dto/leave.dto";

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ==========================================
  // Leave Types & Quotas
  // ==========================================

  async listTypes(tenantId: string, includeInactive = false) {
    return cachedRef(this.cache, tenantId, includeInactive ? "leave_types_all" : "leave_types", () =>
      this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
        tx.leaveType.findMany({
          where: includeInactive ? { tenantId } : { tenantId, isActive: true },
          orderBy: { name: "asc" },
        }),
      ),
    );
  }

  async createType(tenantId: string, dto: CreateLeaveTypeDto) {
    const type = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      try {
        return await tx.leaveType.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            code: dto.code.trim().toUpperCase(),
            annualQuota: dto.annualQuota,
            applicableTo: dto.applicableTo,
          },
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException(`Leave type with code "${dto.code}" already exists.`);
        }
        throw err;
      }
    });
    await invalidateRef(this.cache, tenantId, "leave_types", "leave_types_all");
    return type;
  }

  async updateType(tenantId: string, id: string, dto: UpdateLeaveTypeDto) {
    const type = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const existing = await tx.leaveType.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException("The requested item could not be found.");
      try {
        return await tx.leaveType.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            code: dto.code?.trim().toUpperCase(),
            annualQuota: dto.annualQuota,
            applicableTo: dto.applicableTo,
            isActive: dto.isActive,
          },
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException("A record with this code already exists. Please choose a different one.");
        }
        if (err?.code === "P2025") {
          throw new NotFoundException("The requested item could not be found.");
        }
        throw err;
      }
    });
    await invalidateRef(this.cache, tenantId, "leave_types", "leave_types_all");
    return type;
  }

  // ==========================================
  // Leave Requests & Approvals
  // ==========================================

  async submit(tenantId: string, personId: string, dto: SubmitLeaveRequestDto, isHrAdmin = false) {
    const toUtcDay = (v: string) => {
      const d = new Date(v);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    };
    const startDate = toUtcDay(dto.startDate);
    const endDate = toUtcDay(dto.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("Please check the highlighted fields and try again.");
    }
    if (endDate < startDate) {
      throw new BadRequestException("The end date cannot be before the start date.");
    }
    if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
      throw new BadRequestException("A leave request cannot span two calendar years. Please submit a separate request for each year.");
    }
    if (!isHrAdmin) {
      const now = new Date();
      const earliest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30));
      if (startDate < earliest) {
        throw new BadRequestException("Leave cannot be requested for dates more than 30 days in the past.");
      }
    }
    const docPrefix = `tenants/${tenantId}/leave-docs/`;
    if ((dto.supportingDocuments || []).some((d) => !d.fileKey.startsWith(docPrefix) || d.fileKey.includes(".."))) {
      throw new BadRequestException("Please check the highlighted fields and try again.");
    }

    try {
      return await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
        // Serialize concurrent submissions for the same person for the duration of this transaction.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${personId}))`;

        const person = await tx.person.findFirst({
          where: { id: personId, tenantId },
          include: { manager: true },
        });
        if (!person) throw new NotFoundException("The requested item could not be found.");

        const leaveType = await tx.leaveType.findFirst({
          where: { id: dto.leaveTypeId, tenantId },
        });
        if (!leaveType || !leaveType.isActive) {
          throw new NotFoundException("Selected leave type does not exist or is no longer available.");
        }
        if (leaveType.applicableTo === LeaveApplicability.EMPLOYEE_ONLY && person.personType !== PersonType.EMPLOYEE) {
          throw new BadRequestException("This leave type is available to employees only.");
        }

        // Working days: Mon-Fri, excluding tenant holidays in range.
        const holidays = await tx.holiday.findMany({
          where: { tenantId, date: { gte: startDate, lte: endDate } },
          select: { date: true },
        });
        const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
        let daysCount = 0;
        for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 86400000)) {
          const dow = d.getUTCDay();
          if (dow === 0 || dow === 6) continue;
          if (holidaySet.has(d.toISOString().slice(0, 10))) continue;
          daysCount++;
        }
        if (daysCount < 1) {
          throw new BadRequestException("The selected dates contain no working days. Please choose different dates.");
        }

        const overlap = await tx.leaveRequest.findFirst({
          where: {
            tenantId,
            personId,
            status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        });
        if (overlap) {
          throw new ConflictException("You already have a pending or approved leave request during these dates.");
        }

        const year = startDate.getUTCFullYear();
        const used = await tx.leaveRequest.aggregate({
          where: {
            tenantId,
            personId,
            leaveTypeId: dto.leaveTypeId,
            status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
            startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
          },
          _sum: { daysCount: true },
        });
        const remainingBalance = Math.max(0, leaveType.annualQuota - (used._sum.daysCount || 0));
        if (daysCount > remainingBalance) {
          throw new BadRequestException(
            `Insufficient leave balance. You only have ${remainingBalance} day(s) remaining for ${leaveType.name} in ${year} (annual quota: ${leaveType.annualQuota}).`,
          );
        }

        return tx.leaveRequest.create({
          data: {
            tenantId,
            personId,
            leaveTypeId: dto.leaveTypeId,
            startDate,
            endDate,
            daysCount,
            reason: dto.reason.trim(),
            supportingDocuments: (dto.supportingDocuments || []) as any,
            status: LeaveStatus.PENDING,
            approverId: person.managerId || null,
          },
          include: {
            leaveType: true,
            approver: {
              select: { id: true, firstName: true, middleName: true, lastName: true },
            },
          },
        });
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictException("A leave request for these dates already exists.");
      }
      throw err;
    }
  }

  async getBalances(tenantId: string, personId: string) {
    const types = await this.listTypes(tenantId);
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {

      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(Date.UTC(currentYear, 0, 1));

      const requests = await tx.leaveRequest.findMany({
        where: {
          tenantId,
          personId,
          startDate: { gte: startOfYear, lt: new Date(Date.UTC(currentYear + 1, 0, 1)) },
          status: { in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] },
        },
      });

      const approvedMap = new Map<string, number>();
      const pendingMap = new Map<string, number>();

      for (const req of requests) {
        if (req.status === LeaveStatus.APPROVED) {
          approvedMap.set(req.leaveTypeId, (approvedMap.get(req.leaveTypeId) || 0) + req.daysCount);
        } else if (req.status === LeaveStatus.PENDING) {
          pendingMap.set(req.leaveTypeId, (pendingMap.get(req.leaveTypeId) || 0) + req.daysCount);
        }
      }

      return types.map((t) => {
        const approvedDays = approvedMap.get(t.id) || 0;
        const pendingDays = pendingMap.get(t.id) || 0;
        const remaining = Math.max(0, t.annualQuota - approvedDays - pendingDays);
        return {
          id: t.id,
          name: t.name,
          code: t.code,
          annualQuota: t.annualQuota,
          applicableTo: t.applicableTo,
          approvedDays,
          pendingDays,
          remainingBalance: remaining,
        };
      });
    });
  }

  async cancel(tenantId: string, personId: string, requestId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const request = await tx.leaveRequest.findFirst({
        where: { id: requestId, tenantId, personId },
      });
      if (!request) throw new NotFoundException("Leave request not found or not owned by you.");
      if (request.status !== LeaveStatus.PENDING) {
        throw new ConflictException(`Only pending leave requests can be cancelled. Current status is ${request.status.toLowerCase()}.`);
      }

      return tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: LeaveStatus.CANCELLED },
        include: { leaveType: true },
      });
    });
  }

  async listRequests(
    tenantId: string,
    query?: { personId?: string; approverId?: string; status?: LeaveStatus },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.LeaveRequestWhereInput = { tenantId };

      if (query?.personId) where.personId = query.personId;
      if (query?.approverId) where.approverId = query.approverId;
      if (query?.status) where.status = query.status;

      return tx.leaveRequest.findMany({
        where,
        include: {
          person: {
            select: {
              id: true,
              firstName: true, middleName: true,
              lastName: true,
              personType: true,
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, name: true } },
            },
          },
          leaveType: true,
          approver: {
            select: { id: true, firstName: true, middleName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  /** True if key is attached to a leave request the caller owns, approves, or (HR admin) any in tenant. */
  async canAccessDocument(tenantId: string, key: string, personId: string | undefined, isHrAdmin: boolean) {
    if (!personId && !isHrAdmin) return false;
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const scope: Prisma.LeaveRequestWhereInput[] = [];
      if (personId) scope.push({ personId }, { approverId: personId });
      const found = await tx.leaveRequest.findFirst({
        where: {
          tenantId,
          supportingDocuments: { array_contains: [{ fileKey: key }] },
          ...(isHrAdmin ? {} : { OR: scope }),
        },
        select: { id: true },
      });
      return !!found;
    });
  }

  async decide(
    tenantId: string,
    requestId: string,
    status: "APPROVED" | "REJECTED",
    decisionNotes: string | undefined,
    actor: { personId?: string; isHrAdmin: boolean },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const request = await tx.leaveRequest.findFirst({
        where: { id: requestId, tenantId },
      });

      if (!request) throw new NotFoundException("Leave request not found");
      const isApprover = !!actor.personId && request.approverId === actor.personId;
      const isRequester = !!actor.personId && request.personId === actor.personId;
      if (isRequester || !(isApprover || actor.isHrAdmin)) {
        throw new ForbiddenException("You do not have permission to perform this action.");
      }
      if (request.status !== LeaveStatus.PENDING) {
        throw new ConflictException(`This leave request has already been ${request.status.toLowerCase()}.`);
      }

      return tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status,
          decisionNotes: decisionNotes?.trim() || null,
          decidedAt: new Date(),
        },
        include: {
          leaveType: true,
          person: true,
        },
      });
    });
  }
}
