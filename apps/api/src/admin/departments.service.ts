import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.department.findMany({
        orderBy: { name: "asc" },
        include: {
          persons: {
            where: { status: { not: "EXITED" } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              status: true,
              personType: true,
              managerId: true,
              manager: {
                select: {
                  id: true,
                  firstName: true,
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
                  firstName: true,
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
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const dept = await tx.department.findFirst({ where: { id: departmentId, tenantId } });
      if (!dept) throw new NotFoundException("Department not found");

      const person = await tx.person.findFirst({ where: { id: personId, tenantId } });
      if (!person) throw new NotFoundException("Person not found");

      return tx.person.update({
        where: { id: personId },
        data: {
          departmentId,
          ...(managerId !== undefined ? { managerId } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          departmentId: true,
          managerId: true,
        },
      });
    });
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const dept = await tx.department.findFirst({ where: { id, tenantId } });
      if (!dept) throw new NotFoundException("Department not found");
      await tx.department.delete({ where: { id } });
    });
  }
}
