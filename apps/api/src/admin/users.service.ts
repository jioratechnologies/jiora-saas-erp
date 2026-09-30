import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/services/mail.service";
import type { InviteUserDto } from "./dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  list(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
      tx.user.findMany({
        where: { tenantId },
        include: { roles: { include: { role: true } }, department: true, designation: true },
        orderBy: { createdAt: "asc" },
      }),
    );
  }

  /** Creates the app-side profile and dispatches an invitation email. */
  async invite(tenantId: string, dto: InviteUserDto) {
    const result = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const existing = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email: dto.email } } });
      if (existing) throw new ConflictException(`${dto.email} is already invited or a member`);

      const roles = await tx.role.findMany({ where: { id: { in: dto.roleIds }, tenantId } });
      if (roles.length !== dto.roleIds.length) {
        throw new NotFoundException("One or more roleIds do not exist in this tenant");
      }

      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });

      const user = await tx.user.create({
        data: {
          tenantId,
          email: dto.email,
          displayName: dto.displayName,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          zitadelSubjectId: null,
        },
      });
      await tx.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: user.id, roleId })),
      });
      const createdUser = await tx.user.findUniqueOrThrow({ where: { id: user.id }, include: { roles: true } });
      return {
        user: createdUser,
        tenantName: tenant?.name || "Your Organization",
        roleNames: roles.map((r) => r.name),
      };
    });

    // Dispatch invitation email asynchronously
    this.mail.sendInvitation({
      to: dto.email,
      displayName: dto.displayName,
      tenantName: result.tenantName,
      roleNames: result.roleNames,
    }).catch(() => {});

    return result.user;
  }

  async deactivate(tenantId: string, userId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
      if (!user) throw new NotFoundException("User not found");
      return tx.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } });
    });
  }
}
