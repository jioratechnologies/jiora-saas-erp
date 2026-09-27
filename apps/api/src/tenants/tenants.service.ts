import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TENANT_OWNER_ROLE } from "@saas-erp/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import type { CreateTenantDto, InviteOwnerDto, UpdateTenantThemeDto } from "./dto";

/** Platform-level tenant management — super_admin/developer/maintainer only (see tenants.controller.ts). */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async list() {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, (tx) =>
      tx.tenant.findMany({ orderBy: { createdAt: "asc" } }),
    );
  }

  async create(dto: CreateTenantDto) {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, async (tx) => {
      const existing = await tx.tenant.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException(`Slug "${dto.slug}" is already in use`);

      const tenant = await tx.tenant.create({ data: { name: dto.name, slug: dto.slug } });
      // The tenant's "admin" (org owner) role is seeded immediately — every
      // tenant has it from the moment it exists, never created "later".
      await this.rbac.seedTenantOwnerRole(tx, tenant.id);
      return tenant;
    });
  }

  async suspend(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, async (tx) => {
      await this.assertExists(tx, tenantId);
      return tx.tenant.update({ where: { id: tenantId }, data: { suspendedAt: new Date() } });
    });
  }

  async reinstate(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, async (tx) => {
      await this.assertExists(tx, tenantId);
      return tx.tenant.update({ where: { id: tenantId }, data: { suspendedAt: null } });
    });
  }

  async getOwn(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException("Tenant not found");
      return tenant;
    });
  }

  async getPublicBranding(slug: string) {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { slug },
        select: {
          id: true,
          slug: true,
          name: true,
          customDomain: true,
          logoUrl: true,
          primaryColor: true,
          showPoweredBy: true,
        },
      });
      if (!tenant) throw new NotFoundException(`Organisation "${slug}" not found`);
      return tenant;
    });
  }

  async listPublicTenants() {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, async (tx) => {
      return tx.tenant.findMany({
        where: { suspendedAt: null },
        select: {
          id: true,
          slug: true,
          name: true,
          customDomain: true,
          logoUrl: true,
          primaryColor: true,
          showPoweredBy: true,
        },
        orderBy: { name: "asc" },
      });
    });
  }

  async updateTheme(tenantId: string, dto: UpdateTenantThemeDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      await this.assertExists(tx, tenantId);
      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          primaryColor: dto.primaryColor,
          logoUrl: dto.logoUrl,
          showPoweredBy: dto.showPoweredBy,
        },
      });
    });
  }

  /**
   * There's no other way for anyone to become a tenant's first user: the
   * tenant-scoped invite endpoint (UsersService.invite) requires the caller
   * to already BE a tenant user with admin.user.invite — impossible for a
   * brand-new tenant with zero users. Platform staff bridges that gap once,
   * right after creating the tenant, inviting its owner (who lands with the
   * seeded, protected "admin" role — see RbacService.seedTenantOwnerRole).
   */
  async inviteOwner(tenantId: string, dto: InviteOwnerDto) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      await this.assertExists(tx, tenantId);

      const ownerRole = await tx.role.findFirst({ where: { tenantId, name: TENANT_OWNER_ROLE } });
      if (!ownerRole) throw new NotFoundException("Tenant has no seeded owner role — this shouldn't happen");

      const existing = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email: dto.email } } });
      if (existing) throw new ConflictException(`${dto.email} is already invited or a member of this tenant`);

      const user = await tx.user.create({
        data: { tenantId, email: dto.email, displayName: dto.displayName, zitadelSubjectId: null },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: ownerRole.id } });
      return user;
    });
  }

  /** Platform view of one tenant's users — who's a member, who's still a pending invite. */
  async listUsers(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      await this.assertExists(tx, tenantId);
      return tx.user.findMany({
        where: { tenantId },
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: "asc" },
      });
    });
  }

  /**
   * Only cancels a still-pending invite (zitadelSubjectId null) — deliberately
   * refuses to touch a claimed/active user through this path. Deactivating an
   * active member is UsersService.deactivate, a different, more consequential
   * action gated by the tenant's own admin.user.deactivate permission.
   */
  async cancelInvite(tenantId: string, userId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
      if (!user) throw new NotFoundException("User not found");
      if (user.zitadelSubjectId) {
        throw new ConflictException("This user has already claimed their invite — cannot cancel, only deactivate");
      }
      await tx.user.delete({ where: { id: userId } });
    });
  }

  private async assertExists(tx: Prisma.TransactionClient, tenantId: string) {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
  }
}
