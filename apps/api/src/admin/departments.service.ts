import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.department.findMany({ orderBy: { name: "asc" } }),
    );
  }

  async create(tenantId: string, name: string) {
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

  async delete(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const dept = await tx.department.findFirst({ where: { id, tenantId } });
      if (!dept) throw new NotFoundException("Department not found");
      await tx.department.delete({ where: { id } });
    });
  }
}
