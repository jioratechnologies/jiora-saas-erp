import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CheckInDto, CheckOutDto, SyncAttendanceBatchDto, RegularizeAttendanceDto } from "../dto/attendance.dto";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private getTodayDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  async checkIn(tenantId: string, personId: string, dto: CheckInDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const person = await tx.person.findFirst({ where: { id: personId, tenantId } });
      if (!person) throw new NotFoundException("Person record not found");

      const today = this.getTodayDate();
      const existing = await tx.attendance.findUnique({
        where: {
          tenantId_personId_date: {
            tenantId,
            personId,
            date: today,
          },
        },
      });

      if (existing) {
        throw new ConflictException("You have already checked in for today.");
      }

      return tx.attendance.create({
        data: {
          tenantId,
          personId,
          date: today,
          checkInTime: new Date(),
          mode: dto.mode,
          latitude: dto.latitude,
          longitude: dto.longitude,
          locationName: dto.locationName?.trim(),
          notes: dto.notes?.trim(),
        },
      });
    });
  }

  async checkOut(tenantId: string, personId: string, dto: CheckOutDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const today = this.getTodayDate();
      const attendance = await tx.attendance.findUnique({
        where: {
          tenantId_personId_date: {
            tenantId,
            personId,
            date: today,
          },
        },
      });

      if (!attendance) {
        throw new BadRequestException("No check-in record found for today. Please check in first.");
      }

      if (attendance.checkOutTime) {
        throw new ConflictException("You have already checked out for today.");
      }

      const notes = dto.notes?.trim()
        ? attendance.notes
          ? `${attendance.notes} | Out: ${dto.notes.trim()}`
          : dto.notes.trim()
        : attendance.notes;

      return tx.attendance.update({
        where: { id: attendance.id },
        data: {
          checkOutTime: new Date(),
          notes,
        },
      });
    });
  }

  async getToday(tenantId: string, personId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const today = this.getTodayDate();
      return tx.attendance.findUnique({
        where: {
          tenantId_personId_date: {
            tenantId,
            personId,
            date: today,
          },
        },
      });
    });
  }

  async list(
    tenantId: string,
    query?: { personId?: string; startDate?: string; endDate?: string; departmentId?: string },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.AttendanceWhereInput = { tenantId };

      if (query?.personId) where.personId = query.personId;
      if (query?.departmentId) {
        where.person = { departmentId: query.departmentId };
      }
      if (query?.startDate || query?.endDate) {
        where.date = {};
        if (query.startDate) where.date.gte = new Date(query.startDate);
        if (query.endDate) where.date.lte = new Date(query.endDate);
      }

      return tx.attendance.findMany({
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
        },
        orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
        take: 200,
      });
    });
  }

  async syncBatch(tenantId: string, personId: string, dto: SyncAttendanceBatchDto | any) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const records = Array.isArray(dto)
        ? dto
        : Array.isArray(dto?.records)
        ? dto.records
        : Array.isArray(dto?.items)
        ? dto.items
        : [];

      if (!records || records.length === 0) {
        return [];
      }

      const results: any[] = [];
      for (const item of records) {
        if (!item) continue;
        const offlineId = item.offlineAttendanceId || item.id || `offline-${Date.now()}-${Math.random()}`;

        // Idempotency check: offlineAttendanceId
        const existingOffline = await tx.attendance.findUnique({
          where: {
            tenantId_offlineAttendanceId: {
              tenantId,
              offlineAttendanceId: offlineId,
            },
          },
        });
        if (existingOffline) {
          results.push(existingOffline);
          continue;
        }

        const rawDateStr = item.date || (item.timestamp ? String(item.timestamp).split("T")[0] : new Date().toISOString().split("T")[0]);
        const dateObj = new Date(rawDateStr);
        const utcDate = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));

        // Check if record exists for this date
        const existingDate = await tx.attendance.findUnique({
          where: {
            tenantId_personId_date: {
              tenantId,
              personId,
              date: utcDate,
            },
          },
        });

        const isFlagged = item.deviceSignals?.mockLocation === true || item.deviceSignals?.rootRisk === true;
        const verificationStatus = isFlagged ? "FLAGGED" : "VERIFIED";

        const checkInTimeVal = item.checkInTime
          ? new Date(item.checkInTime)
          : item.type === "CHECK_IN" && item.timestamp
          ? new Date(item.timestamp)
          : new Date();

        const checkOutTimeVal = item.checkOutTime
          ? new Date(item.checkOutTime)
          : item.type === "CHECK_OUT" && item.timestamp
          ? new Date(item.timestamp)
          : null;

        if (existingDate) {
          const updated = await tx.attendance.update({
            where: { id: existingDate.id },
            data: {
              checkOutTime: checkOutTimeVal || existingDate.checkOutTime,
              notes: item.notes ? `${existingDate.notes || ""} | ${item.notes}` : existingDate.notes,
              syncStatus: "SYNCED",
              offlineAttendanceId: offlineId,
            },
          });
          results.push(updated);
        } else {
          const created = await tx.attendance.create({
            data: {
              tenantId,
              personId,
              date: utcDate,
              checkInTime: checkInTimeVal,
              checkOutTime: checkOutTimeVal,
              mode: item.mode || "OFFICE",
              latitude: item.latitude ? Number(item.latitude) : null,
              longitude: item.longitude ? Number(item.longitude) : null,
              locationName: item.locationName,
              notes: item.notes,
              offlineAttendanceId: offlineId,
              verificationMode: "OFFLINE",
              verificationStatus,
              syncStatus: "SYNCED",
              selfieUrl: item.selfieUrl,
              deviceSignals: item.deviceSignals || undefined,
              accuracyMeters: item.accuracyMeters ? Number(item.accuracyMeters) : null,
            },
          });
          results.push(created);
        }
      }
      return results;
    });
  }

  async regularize(tenantId: string, attendanceId: string, adminUserId: string, dto: RegularizeAttendanceDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const attendance = await tx.attendance.findFirst({
        where: { id: attendanceId, tenantId },
        include: { person: true },
      });
      if (!attendance) throw new NotFoundException("Attendance record not found.");

      return tx.attendance.update({
        where: { id: attendanceId },
        data: {
          status: dto.status as any,
          checkInTime: dto.checkInTime ? new Date(dto.checkInTime) : attendance.checkInTime,
          checkOutTime: dto.checkOutTime ? new Date(dto.checkOutTime) : attendance.checkOutTime,
          regularizedBy: adminUserId,
          regularizationReason: dto.reason.trim(),
          regularizedAt: new Date(),
          notes: attendance.notes
            ? `${attendance.notes} [Regularized: ${dto.reason.trim()}]`
            : `[Regularized: ${dto.reason.trim()}]`,
        },
      });
    });
  }

  async getRoster(tenantId: string, dateStr?: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const targetDate = dateStr ? new Date(dateStr) : this.getTodayDate();
      const utcDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));

      // 1. Fetch all active persons
      const persons = await tx.person.findMany({
        where: { tenantId, status: { in: ["ACTIVE", "PROBATION", "NOTICE_PERIOD"] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          personType: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      });

      // 2. Fetch all attendance records for utcDate
      const attendances = await tx.attendance.findMany({
        where: { tenantId, date: utcDate },
      });
      const attendanceMap = new Map(attendances.map((a) => [a.personId, a]));

      // 3. Fetch approved leaves covering utcDate
      const approvedLeaves = await tx.leaveRequest.findMany({
        where: {
          tenantId,
          status: "APPROVED",
          startDate: { lte: utcDate },
          endDate: { gte: utcDate },
        },
        include: {
          leaveType: { select: { name: true, code: true } },
        },
      });
      const leaveMap = new Map(approvedLeaves.map((l) => [l.personId, l]));

      return persons.map((p) => {
        const att = attendanceMap.get(p.id) || null;
        const leave = leaveMap.get(p.id) || null;

        let derivedStatus: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "IN_PROGRESS" = "ABSENT";
        if (att) {
          if (att.status === "HALF_DAY") derivedStatus = "HALF_DAY";
          else if (att.checkOutTime) derivedStatus = "PRESENT";
          else derivedStatus = "IN_PROGRESS";
        } else if (leave) {
          derivedStatus = "ON_LEAVE";
        }

        return {
          person: p,
          attendance: att,
          onLeave: !!leave,
          leaveDetails: leave ? { type: leave.leaveType.name, code: leave.leaveType.code, reason: leave.reason } : null,
          derivedStatus,
        };
      });
    });
  }
}
