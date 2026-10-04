import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PERMISSION_CATALOG, isPlatformPermission } from "@saas-erp/permissions";
import { TENANT_OWNER_ROLE } from "@saas-erp/shared-types";

const TENANT_ASSIGNABLE_PERMISSION_KEYS = PERMISSION_CATALOG.filter((p) => !isPlatformPermission(p.key)).map(
  (p) => p.key,
);

export interface DesignationCaller {
  userId: string;
  permissionKeys: Set<string>;
  isPlatform?: boolean;
}

/**
 * Access is managed per designation: each designation owns one backing
 * role whose permissions (from packages/permissions) its people receive,
 * on top of SELF_SERVICE_PERMISSION_KEYS. The one seeded "admin" role per
 * tenant is protected and cannot be edited — see TENANT_OWNER_ROLE.
 */
@Injectable()
export class RbacService {
  /** Called once, inside the same transaction that creates a new tenant. */
  async seedTenantOwnerRole(tx: Prisma.TransactionClient, tenantId: string) {
    const role = await tx.role.create({
      data: { tenantId, name: TENANT_OWNER_ROLE, isProtected: true },
    });
    await tx.rolePermission.createMany({
      data: TENANT_ASSIGNABLE_PERMISSION_KEYS.map((permissionKey) => ({ roleId: role.id, permissionKey })),
    });
    return role;
  }

  async listRoles(tx: Prisma.TransactionClient, tenantId: string) {
    return tx.role.findMany({
      where: { tenantId },
      include: {
        permissions: true,
        designation: { select: { id: true, name: true, _count: { select: { persons: true } } } },
      },
      orderBy: [{ isProtected: "desc" }, { name: "asc" }],
    });
  }

  /**
   * Creates the access role that backs a designation. Called in the same
   * transaction that creates the designation. Starts with no extra
   * permissions: everyone already gets SELF_SERVICE_PERMISSION_KEYS.
   */
  async createDesignationRole(tx: Prisma.TransactionClient, tenantId: string, designation: { id: string; name: string }) {
    const clash = await tx.role.findFirst({ where: { tenantId, name: designation.name } });
    return tx.role.create({
      data: {
        tenantId,
        name: clash ? `${designation.name} (designation)` : designation.name,
        isProtected: false,
        designationId: designation.id,
      },
    });
  }

  /** Replaces the permission set of a designation's access role. */
  async updateRolePermissions(tx: Prisma.TransactionClient, tenantId: string, roleId: string, permissionKeys: string[]) {
    this.assertAssignable(permissionKeys);
    const role = await this.getOwnedRole(tx, tenantId, roleId);
    if (role.isProtected) {
      throw new ForbiddenException(`"${TENANT_OWNER_ROLE}" is protected and cannot be edited.`);
    }
    if (!role.designationId) {
      throw new BadRequestException("Access is managed per designation.");
    }
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissionKeys.map((permissionKey) => ({ roleId, permissionKey })),
    });
    return tx.role.findUniqueOrThrow({
      where: { id: roleId },
      include: { permissions: true, designation: { select: { id: true, name: true, _count: { select: { persons: true } } } } },
    });
  }

  /**
   * Blocks privilege escalation through designations: a designation grants its
   * role's permissions, so only admins (protected role) or callers who already
   * hold every one of those permissions may assign it, and never to themselves.
   */
  async assertCanAssignDesignation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    designationId: string | null | undefined,
    caller: DesignationCaller,
    targetUserId?: string | null,
  ) {
    if (!designationId || caller.isPlatform) return;
    const denied = "You do not have permission to perform this action.";
    const admin = await tx.userRole.findFirst({
      where: { userId: caller.userId, role: { isProtected: true, tenantId } },
      select: { userId: true },
    });
    if (admin) return;
    if (targetUserId && targetUserId === caller.userId) throw new ForbiddenException(denied);
    const role = await tx.role.findFirst({
      where: { tenantId, designationId },
      include: { permissions: true },
    });
    if (role?.permissions.some((p) => !caller.permissionKeys.has(p.permissionKey))) {
      throw new ForbiddenException(denied);
    }
  }

  private async getOwnedRole(tx: Prisma.TransactionClient, tenantId: string, roleId: string) {
    const role = await tx.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException("The requested item could not be found.");
    return role;
  }

  private assertAssignable(permissionKeys: string[]) {
    const invalid = permissionKeys.filter((key) => !TENANT_ASSIGNABLE_PERMISSION_KEYS.includes(key));
    if (invalid.length > 0) {
      throw new BadRequestException(`Not a tenant-assignable permission: ${invalid.join(", ")}`);
    }
  }
}
