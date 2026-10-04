import type { CacheService } from "./cache.service";

/**
 * Reference-data cache (cache-aside): tenant-scoped keys `ref:{tenantId}:{name}`,
 * 5 minute TTL, and an explicit invalidation on every write path that can change
 * what the cached read returns. Redis down => reads fall back to the DB.
 */
export const REF_TTL_S = 300;

export const refKey = (tenantId: string, name: string) => `ref:${tenantId}:${name}`;

/** Cache-aside read of tenant reference data. */
export function cachedRef<T>(cache: CacheService, tenantId: string, name: string, loader: () => Promise<T>): Promise<T> {
  return cache.wrap(refKey(tenantId, name), REF_TTL_S, loader);
}

/** Drops exact reference keys (e.g. "departments") and/or every key under a prefix ending in ":" (e.g. "holidays:"). */
export async function invalidateRef(cache: CacheService, tenantId: string, ...names: string[]): Promise<void> {
  const exact = names.filter((n) => !n.endsWith(":")).map((n) => refKey(tenantId, n));
  const prefixes = names.filter((n) => n.endsWith(":")).map((n) => refKey(tenantId, n));
  await Promise.all([exact.length ? cache.del(...exact) : Promise.resolve(), ...prefixes.map((p) => cache.delByPrefix(p))]);
}

/** Sent on reference-data GETs only (never user-specific data); Express adds the ETag. */
export const REFERENCE_CACHE_CONTROL = "private, no-cache";
