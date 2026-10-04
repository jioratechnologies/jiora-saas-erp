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
  async get(tenantId: string, userId: string): Promise<PersonContext | null> {
    const key = `pctx:${tenantId}:${userId}`;
    const { value, gen } = await this.authzCache.read<{ p: PersonContext | null }>(key);
    let person: PersonContext | null;
    if (value) {
      person = value.p;
    } else {
      person = await this.prisma.runInTenantContext({ tenantId, isPlatformContext: false }, (tx) =>
        tx.person.findFirst({ where: { userId, tenantId }, select: { id: true, status: true } }),
      );
      await this.authzCache.write(key, gen, { p: person }, PERSON_CTX_TTL_S);
    }
    if (person?.status === PersonStatus.EXITED) {
      throw new ForbiddenException("Your account is no longer active. Please contact HR.");
    }
    return person;
  }

  /** Own person id or null. */
  async getPersonId(tenantId: string, userId: string): Promise<string | null> {
    return (await this.get(tenantId, userId))?.id ?? null;
  }
}
