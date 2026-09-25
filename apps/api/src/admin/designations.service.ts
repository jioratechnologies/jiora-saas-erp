import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DesignationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.designation.findMany({ orderBy: { name: "asc" } }),
    );
  }

  create(tenantId: string, name: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.designation.create({ data: { tenantId, name } }),
    );
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const designation = await tx.designation.findFirst({ where: { id, tenantId } });
      if (!designation) throw new NotFoundException("Designation not found");
      await tx.designation.delete({ where: { id } });
    });
  }
}
