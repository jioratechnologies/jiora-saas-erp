import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PERMISSION_CATALOG, isPlatformPermission } from "@saas-erp/permissions";
import { TENANT_OWNER_ROLE } from "@saas-erp/shared-types";

const TENANT_ASSIGNABLE_PERMISSION_KEYS = PERMISSION_CATALOG.filter((p) => !isPlatformPermission(p.key)).map(
  (p) => p.key,
);

/**
 * Role Builder logic: tenant Admins create/edit/delete custom roles from
 * the fixed permission catalog (packages/permissions). The one seeded
 * "admin" role per tenant is protected and cannot be edited or deleted —
 * see TENANT_OWNER_ROLE in @saas-erp/shared-types.
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
      include: { permissions: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async createRole(tx: Prisma.TransactionClient, tenantId: string, name: string, permissionKeys: string[]) {
    this.assertAssignable(permissionKeys);
    const role = await tx.role.create({ data: { tenantId, name, isProtected: false } });
    await tx.rolePermission.createMany({
      data: permissionKeys.map((permissionKey) => ({ roleId: role.id, permissionKey })),
    });
    return tx.role.findUniqueOrThrow({ where: { id: role.id }, include: { permissions: true } });
  }

  async updateRole(
    tx: Prisma.TransactionClient,
    tenantId: string,
    roleId: string,
    name: string,
    permissionKeys: string[],
  ) {
    this.assertAssignable(permissionKeys);
    const role = await this.getOwnedRole(tx, tenantId, roleId);
    if (role.isProtected) {
      throw new ForbiddenException(`"${TENANT_OWNER_ROLE}" is protected and cannot be edited`);
    }
    await tx.role.update({ where: { id: roleId }, data: { name } });
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissionKeys.map((permissionKey) => ({ roleId, permissionKey })),
    });
    return tx.role.findUniqueOrThrow({ where: { id: roleId }, include: { permissions: true } });
  }

  async deleteRole(tx: Prisma.TransactionClient, tenantId: string, roleId: string) {
    const role = await this.getOwnedRole(tx, tenantId, roleId);
    if (role.isProtected) {
      throw new ForbiddenException(`"${TENANT_OWNER_ROLE}" is protected and cannot be deleted`);
    }
    await tx.role.delete({ where: { id: roleId } });
  }

  private async getOwnedRole(tx: Prisma.TransactionClient, tenantId: string, roleId: string) {
    const role = await tx.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  private assertAssignable(permissionKeys: string[]) {
    const invalid = permissionKeys.filter((key) => !TENANT_ASSIGNABLE_PERMISSION_KEYS.includes(key));
    if (invalid.length > 0) {
      throw new BadRequestException(`Not a tenant-assignable permission: ${invalid.join(", ")}`);
    }
  }
}
