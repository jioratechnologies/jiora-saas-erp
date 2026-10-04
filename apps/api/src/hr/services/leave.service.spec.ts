import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { LeaveService } from "./leave.service";

const T = "t1";

function setup() {
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    person: { findFirst: jest.fn().mockResolvedValue({ id: "p1", personType: "EMPLOYEE", managerId: "m1" }) },
    leaveType: {
      findFirst: jest.fn().mockResolvedValue({ id: "lt1", isActive: true, applicableTo: "ALL", annualQuota: 10, name: "Casual" }),
    },
    holiday: { findMany: jest.fn().mockResolvedValue([]) },
    leaveRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _sum: { daysCount: 0 } }),
      create: jest.fn().mockImplementation(async (a: any) => ({ id: "l1", ...a.data })),
      update: jest.fn().mockResolvedValue({ id: "l1" }),
    },
  };
  const prisma: any = { runInTenantContext: jest.fn((_c: unknown, fn: (t: unknown) => unknown) => fn(tx)) };
  const cache: any = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  return { tx, svc: new LeaveService(prisma, cache) };
}

// 2027-01-01 Fri, 01-02 Sat, 01-03 Sun, 01-04 Mon, 01-05 Tue
const dto = (over: object = {}) => ({ leaveTypeId: "lt1", startDate: "2027-01-01", endDate: "2027-01-05", reason: "trip", ...over }) as any;

// pin clock so the "start > 30 days in the past" rule never trips on the fixed 2027 dates
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(new Date("2026-12-15T00:00:00Z"));
});
afterEach(() => {
  jest.useRealTimers();
});

describe("LeaveService.submit", () => {
  it("excludes weekends", async () => {
    const { svc } = setup();
    expect((await svc.submit(T, "p1", dto())).daysCount).toBe(3);
  });

  it("excludes holidays", async () => {
    const { svc, tx } = setup();
    tx.holiday.findMany.mockResolvedValue([{ date: new Date("2027-01-04T00:00:00Z") }]);
    expect((await svc.submit(T, "p1", dto())).daysCount).toBe(2);
  });

  it("only weekend -> 400", async () => {
    const { svc } = setup();
    await expect(svc.submit(T, "p1", dto({ startDate: "2027-01-02", endDate: "2027-01-03" }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("insufficient balance (PENDING counted in used) -> 400", async () => {
    const { svc, tx } = setup();
    tx.leaveRequest.aggregate.mockResolvedValue({ _sum: { daysCount: 8 } }); // quota 10, 3 requested
    await expect(svc.submit(T, "p1", dto())).rejects.toThrow(/Insufficient leave balance/);
    const where = tx.leaveRequest.aggregate.mock.calls[0][0].where;
    expect(where.status.in).toEqual(expect.arrayContaining(["PENDING", "APPROVED"]));
  });

  it("overlap -> 409", async () => {
    const { svc, tx } = setup();
    tx.leaveRequest.findFirst.mockResolvedValue({ id: "x" });
    await expect(svc.submit(T, "p1", dto())).rejects.toBeInstanceOf(ConflictException);
    expect(tx.leaveRequest.create).not.toHaveBeenCalled();
  });

  it("start >30d in past -> 400 for non-HR", async () => {
    const { svc, tx } = setup();
    await expect(svc.submit(T, "p1", dto({ startDate: "2020-01-06", endDate: "2020-01-07" }))).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.leaveRequest.create).not.toHaveBeenCalled();
  });

  it("past date allowed for HR admin", async () => {
    const { svc } = setup();
    await expect(svc.submit(T, "p1", dto({ startDate: "2020-01-06", endDate: "2020-01-07" }), true)).resolves.toBeDefined();
  });
});

describe("LeaveService.decide", () => {
  const req = { id: "l1", personId: "p1", approverId: "m1", status: "PENDING" };

  it("requester cannot decide own (even HR admin) -> 403", async () => {
    const { svc, tx } = setup();
    tx.leaveRequest.findFirst.mockResolvedValue(req);
    await expect(svc.decide(T, "l1", "APPROVED", undefined, { personId: "p1", isHrAdmin: true })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.leaveRequest.update).not.toHaveBeenCalled();
  });

  it("non-approver non-HR -> 403", async () => {
    const { svc, tx } = setup();
    tx.leaveRequest.findFirst.mockResolvedValue(req);
    await expect(svc.decide(T, "l1", "APPROVED", undefined, { personId: "other", isHrAdmin: false })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("assigned approver passes", async () => {
    const { svc, tx } = setup();
    tx.leaveRequest.findFirst.mockResolvedValue(req);
    await svc.decide(T, "l1", "APPROVED", " ok ", { personId: "m1", isHrAdmin: false });
    expect(tx.leaveRequest.update).toHaveBeenCalledTimes(1);
  });
});
