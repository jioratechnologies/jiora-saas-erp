import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { LeaveStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../cache/cache.service";
import type { CreateLeaveTypeDto, SubmitLeaveRequestDto } from "../dto/leave.dto";

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ==========================================
  // Leave Types & Quotas
  // ==========================================

  async listTypes(tenantId: string) {
    const cacheKey = `tenant:${tenantId}:leave_types`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const types = await tx.leaveType.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: "asc" },
      });

      await this.cache.set(cacheKey, types, 3600); // 1 hour TTL
      return types;
    });
  }

  async createType(tenantId: string, dto: CreateLeaveTypeDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      try {
        const type = await tx.leaveType.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            code: dto.code.trim().toUpperCase(),
            annualQuota: dto.annualQuota,
            applicableTo: dto.applicableTo,
          },
        });

        await this.cache.del(`tenant:${tenantId}:leave_types`);
        return type;
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException(`Leave type with code "${dto.code}" already exists.`);
        }
        throw err;
      }
    });
  }

  // ==========================================
  // Leave Requests & Approvals
  // ==========================================

  async submit(tenantId: string, personId: string, dto: SubmitLeaveRequestDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({
        where: { id: personId, tenantId },
        include: { manager: true },
      });
      if (!person) throw new NotFoundException("Person record not found");

      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      if (startDate > endDate) {
        throw new BadRequestException("Start date cannot be after end date.");
      }

      // Calculate calendar days
      const diffMs = endDate.getTime() - startDate.getTime();
      const daysCount = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

      // Check for overlapping active requests
      const overlap = await tx.leaveRequest.findFirst({
        where: {
          tenantId,
          personId,
          status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
          OR: [
            { startDate: { lte: endDate }, endDate: { gte: startDate } },
          ],
        },
      });

      if (overlap) {
        throw new ConflictException("You already have a pending or approved leave request during these dates.");
      }

      // Check leave quota balance
      const leaveType = await tx.leaveType.findFirst({
        where: { id: dto.leaveTypeId, tenantId },
      });
      if (!leaveType) throw new NotFoundException("Selected leave type does not exist.");

      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
      const existingApproved = await tx.leaveRequest.aggregate({
        where: {
          tenantId,
          personId,
          leaveTypeId: dto.leaveTypeId,
          status: LeaveStatus.APPROVED,
          startDate: { gte: startOfYear },
        },
        _sum: { daysCount: true },
      });
      const approvedDays = existingApproved._sum.daysCount || 0;
      const remainingBalance = Math.max(0, leaveType.annualQuota - approvedDays);

      if (daysCount > remainingBalance) {
        throw new BadRequestException(
          `Insufficient leave balance. You only have ${remainingBalance} day(s) remaining for ${leaveType.name} (annual quota: ${leaveType.annualQuota}).`,
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
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    });
  }

  async getBalances(tenantId: string, personId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const types = await tx.leaveType.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: "asc" },
      });

      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(Date.UTC(currentYear, 0, 1));

      const requests = await tx.leaveRequest.findMany({
        where: {
          tenantId,
          personId,
          startDate: { gte: startOfYear },
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
        const remaining = Math.max(0, t.annualQuota - approvedDays);
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
              firstName: true,
              lastName: true,
              personType: true,
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, name: true } },
            },
          },
          leaveType: true,
          approver: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async decide(
    tenantId: string,
    requestId: string,
    status: "APPROVED" | "REJECTED",
    decisionNotes?: string,
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const request = await tx.leaveRequest.findFirst({
        where: { id: requestId, tenantId },
      });

      if (!request) throw new NotFoundException("Leave request not found");
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
