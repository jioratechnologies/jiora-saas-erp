import { ForbiddenException, Injectable } from "@nestjs/common";
import { PersonStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthzCacheService } from "./authz-cache.service";

export interface PersonContext {
  id: string;
  status: PersonStatus;
}

const PERSON_CTX_TTL_S = 300;

/**
 * Resolves the caller's own HR person (id + status) for a user, cached 5 minutes
 * (`pctx:{tenantId}:{userId}`) and dropped by AuthzCacheService.invalidateTenantAuthz
 * on person create/update/exit/link changes. Replaces the per-request
 * resolvePersonId/getByUserId lookups, each of which cost a 4-round-trip transaction.
 */
@Injectable()
export class PersonContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authzCache: AuthzCacheService,
  ) {}

  /** Own person or null when no profile is linked. Throws 403 for an EXITED person (same rule as PersonsService.getByUserId). */
  async get(tenantId: string | null | undefined, userId: string): Promise<PersonContext | null> {
    if (!tenantId) return null;
    const key = `pctx:${tenantId}:${userId}`;
    const { value, gen } = await this.authzCache.read<{ p: PersonContext | null }>(key);
    let person: PersonContext | null;
    if (value?.p) {
      person = value.p;
    } else {
      person = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
        tx.person.findFirst({ where: { userId, tenantId }, select: { id: true, status: true } }),
      );
      if (!person) person = await this.provision(tenantId, userId);
      await this.authzCache.write(key, gen, { p: person }, PERSON_CTX_TTL_S);
    }
    if (person?.status === PersonStatus.EXITED) {
      throw new ForbiddenException("Your account is no longer active. Please contact HR.");
    }
    return person;
  }

  /** Own person id or null. */
  async getPersonId(tenantId: string | null | undefined, userId: string): Promise<string | null> {
    if (!tenantId) return null;
    return (await this.get(tenantId, userId))?.id ?? null;
  }

  /**
   * A login with no HR profile can't check in, apply for leave, claim, etc. Link an existing
   * unlinked profile with the same email, or create a basic employee profile from the user's
   * own details so every active member can use self-service from their first sign-in.
   */
  private async provision(tenantId: string, userId: string): Promise<PersonContext | null> {
    try {
      return await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, async (tx) => {
        const user = await tx.user.findFirst({ where: { id: userId, tenantId, deactivatedAt: null } });
        // Machine identities have no HR profile.
        if (!user || user.email.endsWith("@zitadel.service.local")) return null;

        const byEmail = await tx.person.findFirst({
          where: { tenantId, userId: null, email: { equals: user.email, mode: "insensitive" } },
          select: { id: true },
        });
        if (byEmail) {
          return tx.person.update({ where: { id: byEmail.id }, data: { userId }, select: { id: true, status: true } });
        }

        const parts = user.displayName.trim().split(/\s+/).filter(Boolean);
        const firstName = parts[0] || user.email.split("@")[0];
        const lastName = parts.length > 1 ? parts[parts.length - 1] : "-";
        const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : null;
        return tx.person.create({
          data: {
            tenantId,
            userId,
            personType: "EMPLOYEE",
            status: "ACTIVE",
            firstName,
            middleName,
            lastName,
            email: user.email,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
            departmentId: user.departmentId,
            designationId: user.designationId,
          },
          select: { id: true, status: true },
        });
      });
    } catch (err: any) {
      // Lost a race with a concurrent request: the profile now exists.
      if (err?.code === "P2002") {
        return this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
          tx.person.findFirst({ where: { userId, tenantId }, select: { id: true, status: true } }),
        );
      }
      throw err;
    }
  }
}
