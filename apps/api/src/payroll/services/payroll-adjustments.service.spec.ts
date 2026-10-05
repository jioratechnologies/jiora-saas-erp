import { ConflictException, NotFoundException } from "@nestjs/common";
import { PayrollAdjustmentsService } from "./payroll-adjustments.service";

function setup(locked: boolean, adj: unknown = { id: "a1", year: 2026, month: 10 }) {
  const tx: any = {
    person: { findFirst: jest.fn().mockResolvedValue({ id: "p1" }) },
    payrollRun: { findFirst: jest.fn().mockResolvedValue(locked ? { id: "r1" } : null) },
    payrollAdjustment: {
      create: jest.fn().mockResolvedValue({ id: "a1" }),
      findFirst: jest.fn().mockResolvedValue(adj),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma: any = { runInTenantContext: jest.fn((_c: unknown, fn: (t: unknown) => unknown) => fn(tx)) };
  return { tx, svc: new PayrollAdjustmentsService(prisma) };
}

const dto: any = { personId: "p1", year: 2026, month: 10, type: "BONUS", amount: 100, reason: " Bonus " };

describe("PayrollAdjustmentsService", () => {
  it("create ok when month open", async () => {
    const { svc, tx } = setup(false);
    await svc.create("t1", "u1", dto);
    expect(tx.payrollAdjustment.create.mock.calls[0][0].data.reason).toBe("Bonus");
  });
  it("create 409 when run approved/disbursed", async () => {
    const { svc, tx } = setup(true);
    await expect(svc.create("t1", "u1", dto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.payrollAdjustment.create).not.toHaveBeenCalled();
  });
  it("remove 409 when locked, 404 when missing", async () => {
    await expect(setup(true).svc.remove("t1", "a1")).rejects.toBeInstanceOf(ConflictException);
    await expect(setup(false, null).svc.remove("t1", "a1")).rejects.toBeInstanceOf(NotFoundException);
  });
  it("remove ok when open", async () => {
    const { svc, tx } = setup(false);
    await expect(svc.remove("t1", "a1")).resolves.toEqual({ id: "a1", year: 2026, month: 10 });
    expect(tx.payrollAdjustment.deleteMany).toHaveBeenCalled();
  });
});
