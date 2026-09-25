import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.department.findMany({ orderBy: { name: "asc" } }),
    );
  }

  create(tenantId: string, name: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.department.create({ data: { tenantId, name } }),
    );
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const dept = await tx.department.findFirst({ where: { id, tenantId } });
      if (!dept) throw new NotFoundException("Department not found");
      await tx.department.delete({ where: { id } });
    });
  }
}
