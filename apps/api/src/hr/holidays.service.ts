import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import type { CreateHolidayDto } from "./dto/holiday.dto";

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async list(tenantId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();
    const cacheKey = `tenant:${tenantId}:holidays:${targetYear}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const startOfYear = new Date(`${targetYear}-01-01`);
      const endOfYear = new Date(`${targetYear}-12-31`);

      const holidays = await tx.holiday.findMany({
        where: {
          tenantId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { date: "asc" },
      });

      await this.cache.set(cacheKey, holidays, 7200); // 2 hours TTL
      return holidays;
    });
  }

  async create(tenantId: string, dto: CreateHolidayDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const holidayDate = new Date(dto.date);
      const year = holidayDate.getFullYear();

      try {
        const holiday = await tx.holiday.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            date: holidayDate,
            isOptional: dto.isOptional ?? false,
          },
        });

        await this.cache.del(`tenant:${tenantId}:holidays:${year}`);
        return holiday;
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException(`A holiday named "${dto.name}" on this date already exists.`);
        }
        throw err;
      }
    });
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const holiday = await tx.holiday.findFirst({ where: { id, tenantId } });
      if (!holiday) throw new NotFoundException("Holiday not found");

      const year = holiday.date.getFullYear();
      await tx.holiday.delete({ where: { id } });
      await this.cache.del(`tenant:${tenantId}:holidays:${year}`);
      return { success: true };
    });
  }
}
