import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CheckInDto, CheckOutDto } from "./dto/attendance.dto";

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
}
