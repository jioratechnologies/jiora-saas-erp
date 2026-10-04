import { ConflictException } from "@nestjs/common";
import { PayrollRunService } from "./payroll-run.service";

const T = "t1";

function setup(status: string) {
  const tx: any = {
    payrollRun: {
      findFirst: jest.fn().mockResolvedValue({ id: "r1", status }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: "r1" }),
    },
    payslip: {
      count: jest.fn().mockResolvedValue(3),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      findMany: jest.fn().mockResolvedValue([{ deductions: [{ code: "ADVANCE_EMI", advanceId: "a1", amount: 500 }] }]),
    },
    salaryAdvance: {
      findMany: jest.fn().mockResolvedValue([{ id: "a1", amountRecovered: 0, amountApproved: 1000, amountRequested: 1000 }]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma: any = { runInTenantContext: jest.fn((_c: unknown, fn: (t: unknown) => unknown) => fn(tx)) };
  return { tx, svc: new PayrollRunService(prisma) };
}

const go = (svc: PayrollRunService, to: string) => svc.updateStatus(T, "r1", "admin", { status: to } as any);

describe("PayrollRunService.updateStatus", () => {
  it("DRAFT -> APPROVED rejected 409", async () => {
    const { svc, tx } = setup("DRAFT");
    await expect(go(svc, "APPROVED")).rejects.toBeInstanceOf(ConflictException);
    expect(tx.payrollRun.updateMany).not.toHaveBeenCalled();
  });

  it.each(["DRAFT", "CALCULATED", "APPROVED", "DISBURSED"])("DISBURSED -> %s rejected 409", async (to) => {
    const { svc } = setup("DISBURSED");
    await expect(go(svc, to)).rejects.toBeInstanceOf(ConflictException);
  });

  it("DRAFT -> CALCULATED needs payslips", async () => {
    const { svc, tx } = setup("DRAFT");
    tx.payslip.count.mockResolvedValue(0);
    await expect(go(svc, "CALCULATED")).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ["DRAFT", "CALCULATED"],
    ["CALCULATED", "APPROVED"],
  ])("%s -> %s passes, no disburse side effects", async (from, to) => {
    const { svc, tx } = setup(from);
    await expect(go(svc, to)).resolves.toEqual({ id: "r1" });
    expect(tx.payslip.updateMany).not.toHaveBeenCalled();
    expect(tx.salaryAdvance.update).not.toHaveBeenCalled();
  });

  it("APPROVED -> DISBURSED: claim count 0 -> 409, side effects skipped", async () => {
    const { svc, tx } = setup("APPROVED");
    tx.payrollRun.updateMany.mockResolvedValue({ count: 0 });
    await expect(go(svc, "DISBURSED")).rejects.toBeInstanceOf(ConflictException);
    expect(tx.payslip.updateMany).not.toHaveBeenCalled();
    expect(tx.salaryAdvance.update).not.toHaveBeenCalled();
  });

  it("APPROVED -> DISBURSED: claim count 1 -> side effects run once", async () => {
    const { svc, tx } = setup("APPROVED");
    await go(svc, "DISBURSED");
    expect(tx.payslip.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.salaryAdvance.update).toHaveBeenCalledTimes(1);
    expect(tx.salaryAdvance.update.mock.calls[0][0].data).toEqual({ amountRecovered: 500, status: "RECOVERING" });
  });
});
