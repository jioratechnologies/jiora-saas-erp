import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TENANT_OWNER_ROLE } from "@saas-erp/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { CacheService } from "../cache/cache.service";
import { REF_TTL_S, cachedRef, invalidateRef } from "../cache/ref-cache";
import { AuthzCacheService } from "../auth/authz-cache.service";
import { MailService } from "../mail/services/mail.service";
import type { CreateTenantDto, InviteOwnerDto, UpdateTenantThemeDto } from "./dto";

/** Platform-level tenant management — super_admin/developer/maintainer only (see tenants.controller.ts). */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly mail: MailService,
    private readonly cache: CacheService,
    private readonly authzCache: AuthzCacheService,
  ) {}

  /** Branding/profile changed: drop the tenant's org row and the public (pre-login) branding caches. */
  private async invalidateOrg(tenantId: string) {
    await Promise.all([invalidateRef(this.cache, tenantId, "org"), this.cache.del("ref:public:tenants"), this.cache.delByPrefix("ref:public:branding:")]);
  }

  async list() {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, (tx) =>
      tx.tenant.findMany({ orderBy: { createdAt: "asc" } }),
    );
  }

  async create(dto: CreateTenantDto) {
    const result = await this.createInTx(dto);
    await this.invalidateOrg("");
    return result;
  }

  private async createInTx(dto: CreateTenantDto) {
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
    const result = await this.suspendInTx(tenantId);
    await Promise.all([this.authzCache.invalidateTenantAuthz(tenantId), this.invalidateOrg(tenantId)]);
    return result;
  }

  private async suspendInTx(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, async (tx) => {
      await this.assertExists(tx, tenantId);
      return tx.tenant.update({ where: { id: tenantId }, data: { suspendedAt: new Date() } });
    });
  }

  async reinstate(tenantId: string) {
    const result = await this.reinstateInTx(tenantId);
    await Promise.all([this.authzCache.invalidateTenantAuthz(tenantId), this.invalidateOrg(tenantId)]);
    return result;
  }

  private async reinstateInTx(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId: null, isPlatformContext: true }, async (tx) => {
      await this.assertExists(tx, tenantId);
      return tx.tenant.update({ where: { id: tenantId }, data: { suspendedAt: null } });
    });
  }

  getOwn(tenantId: string) {
    return cachedRef(this.cache, tenantId, "org", () => this.getOwnFromDb(tenantId));
  }

  private async getOwnFromDb(tenantId: string) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException("Tenant not found");
      return tenant;
    });
  }

  getPublicBranding(slug: string) {
    return this.cache.wrap(`ref:public:branding:${slug}`, REF_TTL_S, () => this.getPublicBrandingFromDb(slug));
  }

  private async getPublicBrandingFromDb(slug: string) {
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

  listPublicTenants() {
    return this.cache.wrap("ref:public:tenants", REF_TTL_S, () => this.listPublicTenantsFromDb());
  }

  private async listPublicTenantsFromDb() {
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
    const result = await this.updateThemeInTx(tenantId, dto);
    await this.invalidateOrg(tenantId);
    return result;
  }

  private async updateThemeInTx(tenantId: string, dto: UpdateTenantThemeDto) {
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

  async updateWorkSchedule(
    tenantId: string,
    dto: {
      workingDaysPerMonth: number;
      workHoursPerDay: number;
      salarySplit: { basic: number; hra: number; other: number };
      timezone?: string;
      officeInTime?: string;
      officeOutTime?: string;
      maxWorkHours?: number;
    },
  ) {
    const result = await this.updateWorkScheduleInTx(tenantId, dto);
    await this.invalidateOrg(tenantId);
    return result;
  }

  private async updateWorkScheduleInTx(
    tenantId: string,
    dto: {
      workingDaysPerMonth: number;
      workHoursPerDay: number;
      salarySplit: { basic: number; hra: number; other: number };
      timezone?: string;
      officeInTime?: string;
      officeOutTime?: string;
      maxWorkHours?: number;
    },
  ) {
    return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      await this.assertExists(tx, tenantId);
      const { basic, hra, other } = dto.salarySplit;
      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          workingDaysPerMonth: dto.workingDaysPerMonth,
          workHoursPerDay: dto.workHoursPerDay,
          salarySplit: { basic, hra, other },
          ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
          ...(dto.officeInTime !== undefined ? { officeInTime: dto.officeInTime } : {}),
          ...(dto.officeOutTime !== undefined ? { officeOutTime: dto.officeOutTime } : {}),
          ...(dto.maxWorkHours !== undefined ? { maxWorkHours: dto.maxWorkHours } : {}),
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
    const result = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      await this.assertExists(tx, tenantId);

      const ownerRole = await tx.role.findFirst({ where: { tenantId, name: TENANT_OWNER_ROLE } });
      if (!ownerRole) throw new NotFoundException("Tenant has no seeded owner role — this shouldn't happen");

      const existing = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email: dto.email } } });
      if (existing) throw new ConflictException(`${dto.email} is already invited or a member of this tenant`);

      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });

      const user = await tx.user.create({
        data: { tenantId, email: dto.email, displayName: dto.displayName, zitadelSubjectId: null },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: ownerRole.id } });
      return { user, tenantName: tenant?.name || "Your Organization" };
    });

    await this.authzCache.invalidateTenantAuthz(tenantId);

    // Dispatch invitation email asynchronously
    this.mail.sendInvitation({
      to: dto.email,
      displayName: dto.displayName,
      tenantName: result.tenantName,
      isOwner: true,
    }).catch(() => {});

    return result.user;
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
    await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
      if (!user) throw new NotFoundException("User not found");
      if (user.zitadelSubjectId) {
        throw new ConflictException("This user has already claimed their invite — cannot cancel, only deactivate");
      }
      await tx.user.delete({ where: { id: userId } });
    });
    await this.authzCache.invalidateTenantAuthz(tenantId);
  }

  private async assertExists(tx: Prisma.TransactionClient, tenantId: string) {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
  }
}
