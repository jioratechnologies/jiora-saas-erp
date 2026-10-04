import { AuthzCacheService } from "./authz-cache.service";
import { fakeCache } from "./fake-cache";

describe("AuthzCacheService", () => {
  it("misses, then hits after write under the same generation", async () => {
    const svc = new AuthzCacheService(fakeCache() as any);
    const first = await svc.read<string>("k");
    expect(first.value).toBeNull();
    await svc.write("k", first.gen, "v", 45);
    expect((await svc.read<string>("k")).value).toBe("v");
  });

  it("invalidateTenantAuthz makes previously cached entries stale", async () => {
    const svc = new AuthzCacheService(fakeCache() as any);
    const { gen } = await svc.read("k");
    await svc.write("k", gen, "v", 45);
    await svc.invalidateTenantAuthz("t1");
    expect((await svc.read("k")).value).toBeNull();
  });

  it("a value loaded before an invalidation is never served (stale generation)", async () => {
    const svc = new AuthzCacheService(fakeCache() as any);
    const { gen } = await svc.read("k"); // reader observes gen 0
    await svc.invalidateTenantAuthz("t1"); // write happens meanwhile
    await svc.write("k", gen, "old", 45); // reader stores late
    expect((await svc.read("k")).value).toBeNull();
  });

  it("fails open when Redis is down", async () => {
    const svc = new AuthzCacheService(fakeCache(true) as any);
    const r = await svc.read("k");
    expect(r).toEqual({ value: null, gen: 0 });
    await expect(svc.write("k", 0, "v", 45)).resolves.toBeUndefined();
    await expect(svc.invalidateTenantAuthz("t1")).resolves.toBeUndefined();
  });
});
