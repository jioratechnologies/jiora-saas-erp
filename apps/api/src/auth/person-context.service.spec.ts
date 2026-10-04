import { ForbiddenException } from "@nestjs/common";
import { PersonContextService } from "./person-context.service";
import { AuthzCacheService } from "./authz-cache.service";
import { fakeCache } from "./fake-cache";

function setup(person: any) {
  const findFirst = jest.fn().mockResolvedValue(person);
  const prisma: any = { runInTenantContext: jest.fn((_c: unknown, fn: (t: unknown) => unknown) => fn({ person: { findFirst } })) };
  const authz = new AuthzCacheService(fakeCache() as any);
  return { svc: new PersonContextService(prisma, authz), findFirst, authz };
}

describe("PersonContextService", () => {
  it("caches the person id (one DB lookup for repeated calls)", async () => {
    const { svc, findFirst } = setup({ id: "p1", status: "ACTIVE" });
    expect(await svc.getPersonId("t1", "u1")).toBe("p1");
    expect(await svc.getPersonId("t1", "u1")).toBe("p1");
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("caches 'no person linked' too", async () => {
    const { svc, findFirst } = setup(null);
    expect(await svc.getPersonId("t1", "u1")).toBeNull();
    expect(await svc.getPersonId("t1", "u1")).toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("rejects an exited person, including right after exit invalidation", async () => {
    const { svc, findFirst, authz } = setup({ id: "p1", status: "ACTIVE" });
    await svc.get("t1", "u1"); // cached as ACTIVE
    findFirst.mockResolvedValue({ id: "p1", status: "EXITED" });
    await authz.invalidateTenantAuthz("t1"); // what PersonsService does on exit finalize
    await expect(svc.get("t1", "u1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.get("t1", "u1")).rejects.toBeInstanceOf(ForbiddenException); // cached EXITED still rejected
  });
});
