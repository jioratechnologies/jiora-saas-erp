import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ZitadelAuthGuard } from "./zitadel-auth.guard";
import { AuthzCacheService } from "./authz-cache.service";
import { fakeCache } from "./fake-cache";

jest.mock("@saas-erp/permissions", () => ({ SELF_SERVICE_PERMISSION_KEYS: ["self.read"] }));
jest.mock("./verify-token", () => ({
  bearerTokenFrom: () => "tok",
  verifyZitadelToken: jest.fn().mockResolvedValue({ sub: "sub-1" }),
}));

const row = { user_id: "u1", tenant_id: "t1", is_platform: false, permission_keys: ["hr.person.read"], suspended: false };

function setup(rows: any[] = [row], down = false) {
  const prisma: any = { $queryRaw: jest.fn().mockResolvedValue(rows) };
  const cache = fakeCache(down);
  const authz = new AuthzCacheService(cache as any);
  const guard = new ZitadelAuthGuard(prisma, authz);
  const req: any = { headers: { authorization: "Bearer x" } };
  const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };
  return { guard, prisma, authz, req, ctx };
}

describe("ZitadelAuthGuard cache", () => {
  it("miss queries the DB once, hit skips the DB", async () => {
    const { guard, prisma, req, ctx } = setup();
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(req.authContext.userId).toBe("u1");
    expect(req.authContext.permissionKeys.has("hr.person.read")).toBe(true);
  });

  it("fails open: Redis down still authenticates via the DB every time", async () => {
    const { guard, prisma, ctx } = setup([row], true);
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("invalidation forces a fresh lookup (suspension takes effect immediately)", async () => {
    const { guard, prisma, authz, ctx } = setup();
    await guard.canActivate(ctx);
    prisma.$queryRaw.mockResolvedValue([{ ...row, suspended: true }]);
    await authz.invalidateTenantAuthz("t1");
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("a cached suspended identity is rejected", async () => {
    const { guard, ctx } = setup([{ ...row, suspended: true }]);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("unknown identity is 401 and not cached", async () => {
    const { guard, prisma, ctx } = setup([]);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
