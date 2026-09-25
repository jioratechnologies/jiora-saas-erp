import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DesignationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.designation.findMany({ orderBy: { name: "asc" } }),
    );
  }

  async create(tenantId: string, name: string) {
    try {
      return await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
        tx.designation.create({ data: { tenantId, name: name.trim() } }),
      );
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new ConflictException(`A designation named "${name}" already exists.`);
      }
      throw err;
    }
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const designation = await tx.designation.findFirst({ where: { id, tenantId } });
      if (!designation) throw new NotFoundException("Designation not found");
      await tx.designation.delete({ where: { id } });
    });
  }
}
