import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { ClaimsService } from "./claims.service";

const T = "t1";

function setup() {
  const tx: any = {
    person: { findFirst: jest.fn().mockResolvedValue({ id: "p1" }) },
    expenseClaim: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: "c1" }),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: "c1" }),
    },
    salaryAdvance: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: "a1" }),
    },
  };
  const prisma: any = { runInTenantContext: jest.fn((_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx)) };
  return { tx, svc: new ClaimsService(prisma) };
}

describe("ClaimsService.submitClaim", () => {
  const base = { title: "Cab", category: "TRAVEL", amount: 10, expenseDate: "2026-10-01" } as any;

  it("rejects fileKey outside tenant claims prefix", async () => {
    const { svc, tx } = setup();
    await expect(
      svc.submitClaim(T, "p1", { ...base, receiptUrls: [{ name: "r", fileKey: "tenants/other/claims/x.pdf" }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.expenseClaim.create).not.toHaveBeenCalled();
  });

  it("rejects path traversal", async () => {
    const { svc } = setup();
    await expect(
      svc.submitClaim(T, "p1", { ...base, receiptUrls: [{ name: "r", fileKey: `tenants/${T}/claims/../x.pdf` }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts own-tenant key", async () => {
    const { svc, tx } = setup();
    await svc.submitClaim(T, "p1", { ...base, receiptUrls: [{ name: "r", fileKey: `tenants/${T}/claims/x.pdf` }] });
    expect(tx.expenseClaim.create).toHaveBeenCalledTimes(1);
  });
});

describe("ClaimsService.decideClaim", () => {
  const dto = { status: "APPROVED" } as any;

  it("self-approve -> 403, no update", async () => {
    const { svc, tx } = setup();
    tx.expenseClaim.findFirst.mockResolvedValue({ id: "c1", personId: "p1" });
    await expect(svc.decideClaim(T, "c1", "p1", dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.expenseClaim.updateMany).not.toHaveBeenCalled();
  });

  it("updateMany count 0 -> 409", async () => {
    const { svc, tx } = setup();
    tx.expenseClaim.findFirst.mockResolvedValue({ id: "c1", personId: "p1" });
    tx.expenseClaim.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.decideClaim(T, "c1", "boss", dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it("count 1 -> returns claim", async () => {
    const { svc, tx } = setup();
    tx.expenseClaim.findFirst.mockResolvedValue({ id: "c1", personId: "p1" });
    tx.expenseClaim.updateMany.mockResolvedValue({ count: 1 });
    await expect(svc.decideClaim(T, "c1", "boss", dto)).resolves.toEqual({ id: "c1" });
  });
});

describe("ClaimsService.decideAdvance", () => {
  const dto = { status: "APPROVED" } as any;
  const adv = { id: "a1", personId: "p1", amountRequested: 1000, tenureMonths: 2 };

  it("self-approve -> 403", async () => {
    const { svc, tx } = setup();
    tx.salaryAdvance.findFirst.mockResolvedValue(adv);
    await expect(svc.decideAdvance(T, "a1", "p1", dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.salaryAdvance.updateMany).not.toHaveBeenCalled();
  });

  it("updateMany count 0 -> 409", async () => {
    const { svc, tx } = setup();
    tx.salaryAdvance.findFirst.mockResolvedValue(adv);
    tx.salaryAdvance.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.decideAdvance(T, "a1", "boss", dto)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("ClaimsService.listAdvancesPaged stats", () => {
  it("outstandingAmount is computed per advance, floored at 0", async () => {
    const { svc, tx } = setup();
    tx.salaryAdvance.findMany = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { amountApproved: 1000, amountRecovered: 400 },
        { amountApproved: 500, amountRecovered: 700 },
      ]);
    tx.salaryAdvance.count = jest.fn().mockResolvedValue(2);
    tx.salaryAdvance.groupBy = jest.fn().mockResolvedValue([{ status: "RECOVERING", _count: { _all: 2 } }]);
    const res: any = await svc.listAdvancesPaged(T, undefined, { page: 1, pageSize: 10, skip: 0, take: 10 });
    expect(res.stats.outstandingAmount).toBe(600);
    expect(res.stats.byStatus.RECOVERING).toBe(2);
  });
});
