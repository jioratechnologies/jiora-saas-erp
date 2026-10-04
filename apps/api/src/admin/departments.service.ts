import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { cachedRef, invalidateRef } from "../cache/ref-cache";

const INVALID = "Please check the highlighted fields and try again.";

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Departments lists embed people and designation counts embed persons: any member change drops both. */
  private invalidate(tenantId: string) {
    return invalidateRef(this.cache, tenantId, "departments", "designations");
  }

  list(tenantId: string) {
    return cachedRef(this.cache, tenantId, "departments", () => this.listFromDb(tenantId));
  }

  private listFromDb(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.department.findMany({
        orderBy: { name: "asc" },
        include: {
          persons: {
            where: { status: { not: "EXITED" } },
            select: {
              id: true,
              firstName: true, middleName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              status: true,
              personType: true,
              managerId: true,
              manager: {
                select: {
                  id: true,
                  firstName: true, middleName: true,
                  lastName: true,
                },
              },
              designation: {
                select: {
                  id: true,
                  name: true,
                },
              },
              directReports: {
                select: {
                  id: true,
                  firstName: true, middleName: true,
                  lastName: true,
                },
              },
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          },
        },
      }),
    );
  }

  async create(tenantId: string, name: string) {
    const result = await this.createInTx(tenantId, name);
    await this.invalidate(tenantId);
    return result;
  }

  private async createInTx(tenantId: string, name: string) {
    try {
      return await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
        tx.department.create({ data: { tenantId, name: name.trim() } }),
      );
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictException(`A department named "${name}" already exists.`);
      }
      throw err;
    }
  }

  async assignMember(tenantId: string, departmentId: string, personId: string, managerId?: string | null) {
    const result = await this.assignMemberInTx(tenantId, departmentId, personId, managerId);
    await this.invalidate(tenantId);
    return result;
  }

  private async assignMemberInTx(tenantId: string, departmentId: string, personId: string, managerId?: string | null) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const dept = await tx.department.findFirst({ where: { id: departmentId, tenantId } });
      if (!dept) throw new NotFoundException("Department not found");

      const person = await tx.person.findFirst({ where: { id: personId, tenantId } });
      if (!person) throw new NotFoundException("Person not found");

      if (managerId) {
        const manager = await tx.person.findFirst({ where: { id: managerId, tenantId } });
        if (!manager || managerId === personId || manager.departmentId !== departmentId) {
          throw new BadRequestException(INVALID);
        }
        let cursor: string | null = manager.managerId;
        for (let i = 0; cursor && i < 50; i++) {
          if (cursor === personId) throw new BadRequestException(INVALID);
          const next: { managerId: string | null } | null = await tx.person.findFirst({
            where: { id: cursor, tenantId },
            select: { managerId: true },
          });
          cursor = next?.managerId ?? null;
        }
      }

      return tx.person.update({
        where: { id: personId },
        data: {
          departmentId,
          ...(managerId !== undefined ? { managerId } : {}),
        },
        select: {
          id: true,
          firstName: true, middleName: true,
          lastName: true,
          email: true,
          departmentId: true,
          managerId: true,
        },
      });
    });
  }

  async setHead(tenantId: string, departmentId: string, personId: string) {
    const result = await this.setHeadInTx(tenantId, departmentId, personId);
    await this.invalidate(tenantId);
    return result;
  }

  private async setHeadInTx(tenantId: string, departmentId: string, personId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const dept = await tx.department.findFirst({ where: { id: departmentId, tenantId } });
      if (!dept) throw new NotFoundException("The requested item could not be found.");
      const members = await tx.person.findMany({
        where: { tenantId, departmentId },
        select: { id: true, managerId: true },
      });
      const ids = new Set(members.map((m) => m.id));
      const head = members.find((m) => m.id === personId);
      if (!head) throw new BadRequestException(INVALID);

      if (head.managerId && ids.has(head.managerId)) {
        await tx.person.update({ where: { id: personId }, data: { managerId: null } });
      }
      const orphans = members
        .filter((m) => m.id !== personId && (!m.managerId || !ids.has(m.managerId)))
        .map((m) => m.id);
      if (orphans.length) {
        await tx.person.updateMany({ where: { id: { in: orphans }, tenantId }, data: { managerId: personId } });
      }
      return { ok: true };
    });
  }

  async removeMember(tenantId: string, departmentId: string, personId: string) {
    const result = await this.removeMemberInTx(tenantId, departmentId, personId);
    await this.invalidate(tenantId);
    return result;
  }

  private async removeMemberInTx(tenantId: string, departmentId: string, personId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const members = await tx.person.findMany({
        where: { tenantId, departmentId },
        select: { id: true, managerId: true },
      });
      const ids = new Set(members.map((m) => m.id));
      const person = members.find((m) => m.id === personId);
      if (!person) throw new NotFoundException("The requested item could not be found.");

      const upper = person.managerId && ids.has(person.managerId) ? person.managerId : null;
      const reports = members.filter((m) => m.managerId === personId).map((m) => m.id);
      if (reports.length) {
        await tx.person.updateMany({ where: { id: { in: reports }, tenantId }, data: { managerId: upper } });
      }
      await tx.person.update({
        where: { id: personId },
        data: { departmentId: null, ...(upper ? { managerId: null } : {}) },
      });
      return { ok: true };
    });
  }

  async delete(tenantId: string, id: string) {
    const result = await this.deleteInTx(tenantId, id);
    await this.invalidate(tenantId);
    return result;
  }

  private async deleteInTx(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const dept = await tx.department.findFirst({ where: { id, tenantId } });
      if (!dept) throw new NotFoundException("Department not found");
      await tx.department.delete({ where: { id } });
    });
  }
}
