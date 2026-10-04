import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../cache/cache.service";
import { cachedRef, invalidateRef } from "../../cache/ref-cache";
import type { CreateHolidayDto } from "../dto/holiday.dto";

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async list(tenantId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();
    return cachedRef(this.cache, tenantId, `holidays:${targetYear}`, () =>
      this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
        tx.holiday.findMany({
          where: {
            tenantId,
            date: { gte: new Date(`${targetYear}-01-01`), lte: new Date(`${targetYear}-12-31`) },
          },
          orderBy: { date: "asc" },
        }),
      ),
    );
  }

  async create(tenantId: string, dto: CreateHolidayDto) {
    const holiday = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      try {
        return await tx.holiday.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            date: new Date(dto.date),
            isOptional: dto.isOptional ?? false,
          },
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          throw new ConflictException(`A holiday named "${dto.name}" on this date already exists.`);
        }
        throw err;
      }
    });
    await invalidateRef(this.cache, tenantId, "holidays:");
    return holiday;
  }

  async delete(tenantId: string, id: string) {
    const result = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const holiday = await tx.holiday.findFirst({ where: { id, tenantId } });
      if (!holiday) throw new NotFoundException("Holiday not found");
      await tx.holiday.delete({ where: { id } });
      return { success: true };
    });
    await invalidateRef(this.cache, tenantId, "holidays:");
    return result;
  }
}
