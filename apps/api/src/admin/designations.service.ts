import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { CacheService } from "../cache/cache.service";
import { cachedRef, invalidateRef } from "../cache/ref-cache";
import { AuthzCacheService } from "../auth/authz-cache.service";

@Injectable()
export class DesignationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly cache: CacheService,
    private readonly authzCache: AuthzCacheService,
  ) {}

  /** A designation's backing role carries permissions, so changes also drop the cached guard identity. */
  private async invalidate(tenantId: string) {
    await Promise.all([invalidateRef(this.cache, tenantId, "designations"), this.authzCache.invalidateTenantAuthz(tenantId)]);
  }

  list(tenantId: string) {
    return cachedRef(this.cache, tenantId, "designations", () => this.listFromDb(tenantId));
  }

  private listFromDb(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.designation.findMany({
        orderBy: { name: "asc" },
        include: {
          role: { select: { id: true, _count: { select: { permissions: true } } } },
          _count: { select: { persons: true } },
        },
      }),
    );
  }

  /** Creates the designation together with the access role that backs it. */
  async create(tenantId: string, name: string) {
    const result = await this.createInTx(tenantId, name);
    await this.invalidate(tenantId);
    return result;
  }

  private async createInTx(tenantId: string, name: string) {
    const trimmed = name.trim();
    try {
      return await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
        const designation = await tx.designation.create({ data: { tenantId, name: trimmed } });
        await this.rbac.createDesignationRole(tx, tenantId, designation);
        return designation;
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictException("A record with this name already exists. Please choose a different one.");
      }
      throw err;
    }
  }

  /** Deleting a designation also deletes its access role (FK cascade). */
  async delete(tenantId: string, id: string) {
    const result = await this.deleteInTx(tenantId, id);
    await this.invalidate(tenantId);
    return result;
  }

  private async deleteInTx(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const designation = await tx.designation.findFirst({
        where: { id, tenantId },
        include: { _count: { select: { persons: true } } },
      });
      if (!designation) throw new NotFoundException("The requested item could not be found.");
      if (designation._count.persons > 0) {
        throw new BadRequestException("Move the people in this designation to another one before deleting it.");
      }
      await tx.designation.delete({ where: { id } });
    });
  }
}
