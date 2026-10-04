import { Injectable } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";

const GEN_KEY = "authz:gen";

const ttlFromEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** TTL (seconds) of cached guard identity lookups. Suspension/role changes also invalidate explicitly. */
export const AUTHZ_CACHE_TTL_S = () => ttlFromEnv("AUTHZ_CACHE_TTL_S", 45);

/**
 * Generation-versioned cache for per-user authorization data (guard identity,
 * person context).
 *
 * Why a generation counter instead of deleting keys: entries are keyed by Zitadel
 * subject / (tenant,user), but a role-permission, designation or tenant-suspend
 * change affects an unknown set of users. Every write path calls
 * `invalidateTenantAuthz()`, which INCRs one Redis counter (`authz:gen`); each
 * entry stores the generation it was read under and is ignored once the counter
 * moved on. O(1), no key scans, and safe across multiple API instances.
 * The generation is read together with the entry (one MGET) BEFORE the DB load, so
 * a value loaded concurrently with an invalidation is stored under the stale
 * generation and never served. Redis down => every read misses (fail-open to DB).
 * Invalidation is global (all tenants): these writes are rare admin actions and the
 * cost is one re-lookup per active user.
 */
@Injectable()
export class AuthzCacheService {
  constructor(private readonly cache: CacheService) {}

  /** Reads `key` plus the current generation in one round trip. `value` is null on miss/stale. */
  async read<T>(key: string): Promise<{ value: T | null; gen: number }> {
    const [entry, gen] = await this.cache.mget<{ g: number; v: T } | number>([key, GEN_KEY]);
    const current = typeof gen === "number" ? gen : 0;
    if (entry && typeof entry === "object" && entry.g === current) return { value: entry.v, gen: current };
    return { value: null, gen: current };
  }

  /** Stores `value` under the generation observed by `read` before the load. */
  async write<T>(key: string, gen: number, value: T, ttlSeconds: number): Promise<void> {
    await this.cache.set(key, { g: gen, v: value }, ttlSeconds);
  }

  /**
   * Drops every cached authz/person-context entry. `tenantId` is accepted for call-site
   * clarity (and a future narrower scheme) but the bump is global.
   */
  async invalidateTenantAuthz(_tenantId?: string | null): Promise<void> {
    await this.cache.incr(GEN_KEY);
  }
}
