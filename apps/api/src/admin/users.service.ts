import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService, type SendInvitationParams } from "../mail/services/mail.service";
import { RbacService } from "../rbac/rbac.service";
import { AuthzCacheService } from "../auth/authz-cache.service";
import type { Prisma } from "@prisma/client";
import type { InviteUserDto } from "./dto";

/** Creates the app-side login profile (no Zitadel subject yet) and its direct roles. Shared by user invite and HR person onboarding. */
export async function createInvitedUserInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: { email: string; displayName: string; departmentId?: string | null; designationId?: string | null; roleIds?: string[] },
) {
  const user = await tx.user.create({
    data: {
      tenantId,
      email: input.email,
      displayName: input.displayName,
      departmentId: input.departmentId ?? undefined,
      designationId: input.designationId ?? undefined,
      zitadelSubjectId: null,
    },
  });
  if (input.roleIds?.length) {
    await tx.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId: user.id, roleId })) });
  }
  return user;
}

/** Sends the invitation email; never throws. Resolves true when the mail was dispatched. */
const inviteLogger = new Logger("InviteMail");

export async function sendInviteMail(mail: MailService, params: SendInvitationParams): Promise<boolean> {
  try {
    const res = await mail.sendInvitation(params);
    if (res?.success === false) inviteLogger.warn("Invitation email was not sent (mail transport unavailable or rejected).");
    return res?.success !== false;
  } catch (err) {
    inviteLogger.error(`Invitation email failed: ${(err as Error)?.message ?? "unknown error"}`);
    return false;
  }
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly rbac: RbacService,
    private readonly authzCache: AuthzCacheService,
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
  async invite(tenantId: string, dto: InviteUserDto, caller: { userId: string; isPlatform: boolean; permissionKeys: Set<string> }) {
    const result = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const existing = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email: dto.email } } });
      if (existing) throw new ConflictException(`${dto.email} is already invited or a member`);

      const roleIds = dto.roleIds ?? [];
      const roles = await tx.role.findMany({ where: { id: { in: roleIds }, tenantId } });
      if (roles.length !== roleIds.length) {
        throw new NotFoundException("The requested item could not be found.");
      }
      // Access comes from the designation; only the organisation admin role is handed out directly.
      if (roles.some((r) => !r.isProtected)) {
        throw new BadRequestException("Access is set by the person's designation. Choose a designation instead.");
      }

      // Only a holder of a protected (admin) role, or platform staff, may hand one out.
      if (roles.some((r) => r.isProtected) && !caller.isPlatform) {
        const held = await tx.userRole.findFirst({
          where: { userId: caller.userId, role: { isProtected: true, tenantId } },
        });
        if (!held) throw new ForbiddenException("You do not have permission to perform this action.");
      }

      const department = dto.departmentId
        ? await tx.department.findFirst({ where: { id: dto.departmentId, tenantId } })
        : null;
      if (dto.departmentId && !department) {
        throw new BadRequestException("Please check the highlighted fields and try again.");
      }
      const designation = dto.designationId
        ? await tx.designation.findFirst({ where: { id: dto.designationId, tenantId } })
        : null;
      if (dto.designationId && !designation) {
        throw new BadRequestException("Please check the highlighted fields and try again.");
      }

      await this.rbac.assertCanAssignDesignation(tx, tenantId, dto.designationId ?? null, caller, null);

      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });

      const user = await createInvitedUserInTx(tx, tenantId, {
        email: dto.email,
        displayName: dto.displayName,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        roleIds,
      });
      const createdUser = await tx.user.findUniqueOrThrow({ where: { id: user.id }, include: { roles: true } });
      return {
        user: createdUser,
        tenantName: tenant?.name || "Your Organization",
        departmentName: department?.name,
        designationName: designation?.name,
        isAdmin: roles.some((r) => r.isProtected),
        roleNames: [...roles.map((r) => r.name), ...(designation ? [designation.name] : [])],
      };
    });

    await this.authzCache.invalidateTenantAuthz(tenantId);

    // Dispatch invitation email asynchronously
    void sendInviteMail(this.mail, {
      to: dto.email,
      displayName: dto.displayName,
      tenantName: result.tenantName,
      roleNames: result.roleNames,
      departmentName: result.departmentName,
      designationName: result.designationName,
      isAdmin: result.isAdmin,
    });

    return result.user;
  }

  async deactivate(tenantId: string, userId: string) {
    const updated = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
      if (!user) throw new NotFoundException("User not found");
      return tx.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } });
    });
    await this.authzCache.invalidateTenantAuthz(tenantId);
    return updated;
  }

  /** Permanently removes a deactivated user's login. The linked HR person record is kept (user_id is set null). */
  async remove(tenantId: string, userId: string, callerId: string): Promise<void> {
    try {
      await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
        const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
        if (!user) throw new NotFoundException("The requested item could not be found.");
        if (user.id === callerId) throw new ForbiddenException("You do not have permission to perform this action.");
        if (!user.deactivatedAt) throw new BadRequestException("Deactivate this user before deleting them.");
        const isAdmin = await tx.userRole.findFirst({ where: { userId, role: { isProtected: true, tenantId } } });
        if (isAdmin) {
          const others = await tx.userRole.count({
            where: { userId: { not: userId }, role: { isProtected: true, tenantId }, user: { deactivatedAt: null } },
          });
          if (others === 0) throw new BadRequestException("You cannot delete the last administrator of this organisation.");
        }
        await tx.user.delete({ where: { id: userId } });
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2025") throw new NotFoundException("The requested item could not be found.");
      if (code === "P2003") throw new ConflictException("This user is still linked to other records and cannot be deleted.");
      throw e;
    }
    await this.authzCache.invalidateTenantAuthz(tenantId);
  }
}
