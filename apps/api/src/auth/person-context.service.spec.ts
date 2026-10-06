import { ForbiddenException } from "@nestjs/common";
import { PersonContextService } from "./person-context.service";
import { AuthzCacheService } from "./authz-cache.service";
import { fakeCache } from "./fake-cache";

function setup(person: any, user: any = null) {
  const findFirst = jest.fn().mockResolvedValue(person);
  const create = jest.fn().mockImplementation(async ({ data }: any) => ({ id: "new", status: "ACTIVE", ...data }));
  const update = jest.fn().mockResolvedValue({ id: "linked", status: "ACTIVE" });
  const userFindFirst = jest.fn().mockResolvedValue(user);
  const tx = { person: { findFirst, create, update }, user: { findFirst: userFindFirst } };
  const prisma: any = { runInTenantContext: jest.fn((_c: unknown, fn: (t: unknown) => unknown) => fn(tx)) };
  const authz = new AuthzCacheService(fakeCache() as any);
  return { svc: new PersonContextService(prisma, authz), findFirst, create, update, authz };
}

describe("PersonContextService", () => {
  it("caches the person id (one DB lookup for repeated calls)", async () => {
    const { svc, findFirst } = setup({ id: "p1", status: "ACTIVE" });
    expect(await svc.getPersonId("t1", "u1")).toBe("p1");
    expect(await svc.getPersonId("t1", "u1")).toBe("p1");
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("returns null when there is no profile and no active user to build one from", async () => {
    const { svc, create } = setup(null, null);
    expect(await svc.getPersonId("t1", "u1")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a basic employee profile for a login that has none", async () => {
    const { svc, create } = setup(null, { id: "u1", email: "nirmal@x.com", displayName: "Nirmal Kumar Yadav", phone: null, avatarUrl: null, departmentId: "d1", designationId: "g1" });
    expect(await svc.getPersonId("t1", "u1")).toBe("new");
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: "u1", firstName: "Nirmal", middleName: "Kumar", lastName: "Yadav", personType: "EMPLOYEE", designationId: "g1" });
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
