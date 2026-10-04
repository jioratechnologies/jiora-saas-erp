import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { PageParams, toPaged } from "../../common/pagination";
import { SyncAttendanceItemDto } from "../dto/attendance.dto";
import type { CheckInDto, CheckOutDto, SyncAttendanceBatchDto, RegularizeAttendanceDto, ManualAttendanceDto } from "../dto/attendance.dto";

const DAY_MS = 86400000;
const MAX_SYNC_BATCH = 200;
const MAX_SYNC_AGE_DAYS = 60;
const BAD_DATE_MSG = "Please enter a valid date (YYYY-MM-DD).";
const MAX_REPORT_DAYS = 92;
const RANGE_TOO_LONG_MSG = `Please choose a date range of ${MAX_REPORT_DAYS} days or fewer.`;

/** Parses a date string to a UTC-midnight day; throws a plain 400 on invalid input. */
function parseDay(value: string): Date {
  // Plain YYYY-MM-DD (or ISO prefix) is the day key as-is, matching getTodayDate's key format.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (m) {
    const key = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
    if (!Number.isNaN(key.getTime())) return key;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(BAD_DATE_MSG);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Today's date key in the business timezone (ATTENDANCE_TIMEZONE, default Asia/Kolkata), as UTC midnight. */
  private getTodayDate(): Date {
    const tz = process.env.ATTENDANCE_TIMEZONE || "Asia/Kolkata";
    let ymd: string;
    try {
      ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch {
      ymd = new Date().toISOString().slice(0, 10);
    }
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  async checkIn(tenantId: string, personId: string, dto: CheckInDto) {
    try {
      return await this.checkInTx(tenantId, personId, dto);
    } catch (err: any) {
      if (err?.code === "P2002") throw new ConflictException("You have already checked in for today.");
      throw err;
    }
  }

  private async checkInTx(tenantId: string, personId: string, dto: CheckInDto) {
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
    scopePersonIds?: string[],
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const where: Prisma.AttendanceWhereInput = { tenantId };

      if (scopePersonIds) {
        const ids = query?.personId ? scopePersonIds.filter((id) => id === query.personId) : scopePersonIds;
        where.personId = { in: ids };
      } else if (query?.personId) where.personId = query.personId;
      if (query?.departmentId) {
        where.person = { departmentId: query.departmentId };
      }
      if (query?.startDate || query?.endDate) {
        where.date = {};
        if (query.startDate) where.date.gte = parseDay(query.startDate);
        if (query.endDate) where.date.lte = parseDay(query.endDate);
        if (query.startDate && query.endDate) {
          const days = Math.round((parseDay(query.endDate).getTime() - parseDay(query.startDate).getTime()) / DAY_MS) + 1;
          if (days > MAX_REPORT_DAYS) throw new BadRequestException(RANGE_TOO_LONG_MSG);
          if (days < 1) throw new BadRequestException("The start date must be on or before the end date.");
        }
      }

      return tx.attendance.findMany({
        where,
        include: {
          person: {
            select: {
              id: true,
              firstName: true, middleName: true,
              lastName: true,
              email: true,
              personType: true,
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
        take: query?.startDate && query?.endDate ? 10000 : 200,
      });
    });
  }

  /** Paged personal history for one month (YYYY-MM, default current month in business timezone). */
  async listMine(tenantId: string, personId: string, month: string | undefined, paging: PageParams) {
    let start: Date;
    if (month !== undefined && month !== "") {
      const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
      if (!m) throw new BadRequestException("Please choose a valid month (YYYY-MM).");
      start = new Date(`${m[1]}-${m[2]}-01T00:00:00.000Z`);
    } else {
      const t = this.getTodayDate();
      start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
    }
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const where: Prisma.AttendanceWhereInput = { tenantId, personId, date: { gte: start, lt: end } };

    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const [items, total] = await Promise.all([
        tx.attendance.findMany({
          where,
          select: {
            id: true,
            date: true,
            checkInTime: true,
            checkOutTime: true,
            mode: true,
            status: true,
            verificationMode: true,
            verificationStatus: true,
            syncStatus: true,
            locationName: true,
            notes: true,
            regularizedBy: true,
            regularizationReason: true,
          },
          orderBy: [{ date: "desc" }, { checkInTime: "desc" }, { id: "asc" }],
          skip: paging.skip,
          take: paging.take,
        }),
        tx.attendance.count({ where }),
      ]);
      return toPaged(items, total, paging);
    });
  }

  async syncBatch(tenantId: string, personId: string, dto: SyncAttendanceBatchDto | any) {
    const records: any[] = Array.isArray(dto)
      ? dto
      : Array.isArray(dto?.records)
      ? dto.records
      : Array.isArray(dto?.items)
      ? dto.items
      : [];
    if (records.length > MAX_SYNC_BATCH) {
      throw new BadRequestException(`You can sync at most ${MAX_SYNC_BATCH} records at a time.`);
    }

    const results: any[] = [];
    for (const raw of records) {
      const offlineId = typeof raw?.offlineAttendanceId === "string" ? raw.offlineAttendanceId : null;
      try {
        const item = plainToInstance(SyncAttendanceItemDto, raw ?? {});
        const errors = await validate(item, { whitelist: true });
        if (errors.length > 0) throw new BadRequestException("Please check the highlighted fields and try again.");
        const out = await this.syncOneWithRetry(tenantId, personId, item);
        results.push({ offlineAttendanceId: item.offlineAttendanceId, ...out });
      } catch (err: any) {
        const message =
          err instanceof BadRequestException || err instanceof ConflictException
            ? err.message
            : "Something went wrong on the server. Please try again in a moment.";
        results.push({ offlineAttendanceId: offlineId, status: "REJECTED", error: message });
      }
    }
    return results;
  }

  private async syncOneWithRetry(tenantId: string, personId: string, item: SyncAttendanceItemDto) {
    try {
      return await this.syncOne(tenantId, personId, item);
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
      // Concurrent insert won the race; the retry sees it and returns/merges.
      return await this.syncOne(tenantId, personId, item);
    }
  }

  private async syncOne(tenantId: string, personId: string, item: SyncAttendanceItemDto) {
    const date = parseDay(item.date);
    const checkIn = new Date(item.checkInTime);
    const checkOut = item.checkOutTime ? new Date(item.checkOutTime) : null;
    const now = Date.now();
    if (date.getTime() > now + DAY_MS || checkIn.getTime() > now + DAY_MS || (checkOut && checkOut.getTime() > now + DAY_MS)) {
      throw new BadRequestException("Attendance cannot be recorded for a future date.");
    }
    if (date.getTime() < now - MAX_SYNC_AGE_DAYS * DAY_MS) {
      throw new BadRequestException(`Attendance older than ${MAX_SYNC_AGE_DAYS} days cannot be synced. Please ask HR to regularize it.`);
    }
    if (checkOut && checkOut <= checkIn) {
      throw new BadRequestException("Check-out time must be after check-in time.");
    }

    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const offlineId = item.offlineAttendanceId;
      const existingOffline = await tx.attendance.findUnique({
        where: { tenantId_offlineAttendanceId: { tenantId, offlineAttendanceId: offlineId } },
      });
      if (existingOffline) {
        if (existingOffline.personId !== personId) throw new ConflictException("This record has already been synced.");
        return { status: "DUPLICATE", record: existingOffline };
      }

      const existingDate = await tx.attendance.findUnique({
        where: { tenantId_personId_date: { tenantId, personId, date } },
      });
      if (existingDate) {
        // Merge only missing data; never overwrite or append notes.
        if (!existingDate.checkOutTime && checkOut) {
          const updated = await tx.attendance.update({
            where: { id: existingDate.id },
            data: {
              checkOutTime: checkOut,
              syncStatus: "SYNCED",
              offlineAttendanceId: existingDate.offlineAttendanceId ?? offlineId,
            },
          });
          return { status: "MERGED", record: updated };
        }
        return { status: "DUPLICATE", record: existingDate };
      }

      const flagged = item.deviceSignals?.mockLocation === true || item.deviceSignals?.rootRisk === true;
      const created = await tx.attendance.create({
        data: {
          tenantId,
          personId,
          date,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          mode: item.mode || "OFFICE",
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          locationName: item.locationName,
          notes: item.notes,
          offlineAttendanceId: offlineId,
          verificationMode: "OFFLINE",
          verificationStatus: flagged ? "FLAGGED" : "VERIFIED",
          syncStatus: "SYNCED",
          selfieUrl: item.selfieUrl,
          deviceSignals: item.deviceSignals || undefined,
          accuracyMeters: item.accuracyMeters ?? null,
        },
      });
      return { status: "CREATED", record: created };
    });
  }

  async regularize(tenantId: string, attendanceId: string, adminUserId: string, dto: RegularizeAttendanceDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const attendance = await tx.attendance.findFirst({
        where: { id: attendanceId, tenantId },
      });
      if (!attendance) throw new NotFoundException("The requested item could not be found.");

      // No separate approval flow exists, so regularizing is an approval: forbid approving own record.
      const actor = await tx.person.findFirst({ where: { tenantId, userId: adminUserId }, select: { id: true } });
      if (actor && actor.id === attendance.personId) {
        throw new ForbiddenException("You cannot regularize your own attendance. Please ask another approver.");
      }

      const checkInTime = dto.checkInTime ? new Date(dto.checkInTime) : attendance.checkInTime;
      const checkOutTime = dto.checkOutTime ? new Date(dto.checkOutTime) : attendance.checkOutTime;
      if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
        throw new BadRequestException("Check-out time must be after check-in time.");
      }

      const reason = dto.reason.trim();
      const prev = `prev status=${attendance.status}, in=${attendance.checkInTime?.toISOString() ?? "-"}, out=${attendance.checkOutTime?.toISOString() ?? "-"}`;
      const entry = `[Regularized: ${reason} (${prev})]`;

      return tx.attendance.update({
        where: { id: attendanceId },
        data: {
          status: dto.status as any,
          checkInTime,
          checkOutTime,
          regularizedBy: adminUserId,
          regularizationReason: reason,
          regularizedAt: new Date(),
          notes: attendance.notes ? `${attendance.notes} ${entry}` : entry,
        },
      });
    });
  }

  /** Creates a record on behalf of another person (manager/HR). Existing records must be regularized instead. */
  async createManual(
    tenantId: string,
    callerUserId: string,
    callerPersonId: string | undefined,
    callerName: string,
    dto: ManualAttendanceDto,
    scopePersonIds?: string[],
  ) {
    if (callerPersonId && dto.personId === callerPersonId) {
      throw new ForbiddenException("You cannot record your own attendance manually. Please ask another approver.");
    }
    if (scopePersonIds && !scopePersonIds.includes(dto.personId)) {
      throw new ForbiddenException("You do not have permission to perform this action.");
    }
    const date = parseDay(dto.date);
    if (date.getTime() > this.getTodayDate().getTime()) {
      throw new BadRequestException("Attendance cannot be recorded for a future date.");
    }
    const withTimes = dto.status === "PRESENT" || dto.status === "HALF_DAY";
    const checkOut = withTimes && dto.checkOutTime ? new Date(dto.checkOutTime) : null;
    const checkIn = withTimes && dto.checkInTime ? new Date(dto.checkInTime) : null;
    if (withTimes && !checkIn) throw new BadRequestException("Please check the highlighted fields and try again.");
    if (checkIn && checkOut && checkOut <= checkIn) {
      throw new BadRequestException("Check-out time must be after check-in time.");
    }
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("Please check the highlighted fields and try again.");

    try {
      return await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
        const person = await tx.person.findFirst({ where: { id: dto.personId, tenantId }, select: { id: true } });
        if (!person) throw new NotFoundException("The requested item could not be found.");
        const existing = await tx.attendance.findUnique({
          where: { tenantId_personId_date: { tenantId, personId: dto.personId, date } },
        });
        if (existing) {
          throw new ConflictException("An attendance record already exists for this day. Please regularize it instead.");
        }
        return tx.attendance.create({
          data: {
            tenantId,
            personId: dto.personId,
            date,
            checkInTime: checkIn ?? date,
            checkOutTime: checkOut,
            mode: "OFFICE",
            status: dto.status as any,
            verificationMode: "MANUAL",
            regularizedBy: callerUserId,
            regularizationReason: reason,
            regularizedAt: new Date(),
            notes: `[Manual entry by ${callerName}: ${reason}]`,
          },
        });
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictException("An attendance record already exists for this day. Please regularize it instead.");
      }
      throw err;
    }
  }

  /** Caller's own person id plus their direct reports. */
  async getVisiblePersonIds(tenantId: string, personId: string | undefined): Promise<string[]> {
    if (!personId) return [];
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const reports = await tx.person.findMany({ where: { tenantId, managerId: personId }, select: { id: true } });
      return [personId, ...reports.map((r) => r.id)];
    });
  }

  async getRoster(tenantId: string, dateStr?: string, scopePersonIds?: string[]) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const utcDate = dateStr ? parseDay(dateStr) : this.getTodayDate();

      // 1. Fetch all active persons
      const persons = await tx.person.findMany({
        where: {
          tenantId,
          status: { in: ["ACTIVE", "PROBATION", "NOTICE_PERIOD"] },
          ...(scopePersonIds ? { id: { in: scopePersonIds } } : {}),
        },
        select: {
          id: true,
          firstName: true, middleName: true,
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
