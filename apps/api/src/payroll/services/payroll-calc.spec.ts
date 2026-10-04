import {
  attendanceCredit,
  computeDayBreakdown,
  computeDayRatePay,
  computePf,
  computePt,
  computeTds,
  earningsFromSplit,
  isUnpaidLeaveType,
  normalizeSplit,
  round2,
  workingDayKeys,
} from "./payroll-calc";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("round2", () => {
  it("rounds to 2 decimals", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(10.234)).toBe(10.23);
    expect(round2(0)).toBe(0);
  });
});

describe("workingDayKeys", () => {
  it("skips weekends (Oct 2026 has 22 working days)", () => {
    const keys = workingDayKeys(2026, 10, new Set());
    expect(keys).toHaveLength(22);
    expect(keys[0]).toBe("2026-10-01");
    expect(keys).not.toContain("2026-10-03"); // Saturday
    expect(keys).not.toContain("2026-10-04"); // Sunday
  });
  it("skips holidays", () => {
    const keys = workingDayKeys(2026, 10, new Set(["2026-10-02"]));
    expect(keys).toHaveLength(21);
    expect(keys).not.toContain("2026-10-02");
  });
});

describe("isUnpaidLeaveType", () => {
  it("detects unpaid/LOP only", () => {
    expect(isUnpaidLeaveType({ name: "Unpaid Leave" })).toBe(true);
    expect(isUnpaidLeaveType({ name: "x", code: "LOP" })).toBe(true);
    expect(isUnpaidLeaveType({ name: "Casual Leave", code: "CL" })).toBe(false);
    expect(isUnpaidLeaveType({})).toBe(false);
  });
});

const dt = (s: string) => new Date(s);
const present = (day: string, inH: number | null, outH: number | null) => ({
  date: d(day),
  status: "PRESENT",
  checkInTime: inH === null ? null : dt(`${day}T${String(inH).padStart(2, "0")}:00:00.000Z`),
  checkOutTime: outH === null ? null : dt(`${day}T${String(outH).padStart(2, "0")}:00:00.000Z`),
});

describe("attendanceCredit (10h day)", () => {
  it("full when worked >= half the work hours", () => {
    expect(attendanceCredit(present("2026-10-01", 9, 14), 10)).toBe(1); // 5h
  });
  it("half when PRESENT but worked < half", () => {
    expect(attendanceCredit(present("2026-10-01", 9, 13), 10)).toBe(0.5); // 4h
  });
  it("open punch (no check-out) is a full day", () => {
    expect(attendanceCredit(present("2026-10-01", 9, null), 10)).toBe(1);
  });
  it("HALF_DAY 0.5, ABSENT 0", () => {
    expect(attendanceCredit({ date: d("2026-10-01"), status: "HALF_DAY" }, 10)).toBe(0.5);
    expect(attendanceCredit({ date: d("2026-10-01"), status: "ABSENT" }, 10)).toBe(0);
  });
});

describe("computeDayBreakdown", () => {
  const wd = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"];
  const run = (att: any[], leaves: any[] = [], start = "2026-10-01", end = "2026-10-31") =>
    computeDayBreakdown(wd, start, end, att, leaves, 10);

  it("counts present, short-shift half, HALF_DAY and absent", () => {
    const r = run([
      present("2026-10-01", 9, 19),
      present("2026-10-02", 9, 12),
      { date: d("2026-10-05"), status: "HALF_DAY" },
    ]);
    expect(r).toMatchObject({ expectedDays: 4, presentDays: 1, halfDays: 2, absentDays: 1, paidDays: 2 });
    expect(r.workedHours).toBe(13);
  });

  it("ignores weekend punches", () => {
    expect(run([{ date: d("2026-10-03"), status: "PRESENT" }]).paidDays).toBe(0);
  });

  it("paid leave = 1, unpaid leave = 0, overriding attendance", () => {
    const r = run(
      [
        { date: d("2026-10-01"), status: "ON_LEAVE" },
        { date: d("2026-10-05"), status: "PRESENT" },
      ],
      [
        { startDate: d("2026-10-01"), endDate: d("2026-10-01"), unpaid: false },
        { startDate: d("2026-10-05"), endDate: d("2026-10-05"), unpaid: true },
      ],
    );
    expect(r).toMatchObject({ paidLeaveDays: 1, unpaidLeaveDays: 1, paidDays: 1 });
  });

  it("unpaid span wins on overlap", () => {
    const r = run([], [
      { startDate: d("2026-10-01"), endDate: d("2026-10-02"), unpaid: false },
      { startDate: d("2026-10-02"), endDate: d("2026-10-02"), unpaid: true },
    ]);
    expect(r.paidDays).toBe(1);
  });

  it("limits to active window (joiner/leaver)", () => {
    const r = run([{ date: d("2026-10-05"), status: "PRESENT" }], [], "2026-10-05", "2026-10-05");
    expect(r).toMatchObject({ expectedDays: 1, paidDays: 1 });
  });
});

describe("computeDayRatePay (base 44000, setting 22 => 2000/day)", () => {
  const pay = (W: number, paid: number, M: number) => computeDayRatePay(44000, 22, W, paid, M);
  it("fixed day rate and lop", () => {
    expect(pay(22, 20, 22)).toEqual({ perDayRate: 2000, unpaidDays: 2, lopAmount: 4000, earnedGross: 40000 });
  });
  it("half day costs half a day rate", () => {
    const r = pay(22, 21.5, 22);
    expect(r.lopAmount).toBe(1000);
    expect(r.earnedGross).toBe(43000);
  });
  it("full month present: 23-day and 20-day months both pay 44000", () => {
    expect(pay(23, 23, 23).earnedGross).toBe(44000);
    expect(pay(20, 20, 20).earnedGross).toBe(44000);
  });
  it("3 absent of 23 -> 38000", () => expect(pay(23, 20, 23).earnedGross).toBe(38000));
  it("joiner: W=5 present -> 10000 (M=23 or 20), absent 1 -> 8000", () => {
    expect(pay(5, 5, 23).earnedGross).toBe(10000);
    expect(pay(5, 5, 20).earnedGross).toBe(10000);
    expect(pay(5, 4, 23).earnedGross).toBe(8000);
  });
  it("leaver: W=10 -> 20000 (lop 24000), absent 1 -> 18000", () => {
    expect(pay(10, 10, 23).earnedGross).toBe(20000);
    expect(pay(10, 10, 23).lopAmount).toBe(24000);
    expect(pay(10, 9, 23).earnedGross).toBe(18000);
  });
  it("lop never exceeds baseGross", () => {
    const r = pay(40, 0, 40);
    expect(r.lopAmount).toBe(44000);
    expect(r.earnedGross).toBe(0);
  });
  it("no unpaid days when paid >= expected", () => {
    expect(computeDayRatePay(1000, 22, 5, 6, 22).unpaidDays).toBe(0);
  });
});

describe("earningsFromSplit", () => {
  it("splits 50/25/25 of earned gross", () => {
    expect(earningsFromSplit(40000, { basic: 50, hra: 25, other: 25 }).map((e) => e.amount)).toEqual([20000, 10000, 10000]);
  });
  it("other absorbs rounding when split sums to 100", () => {
    const out = earningsFromSplit(100.01, { basic: 33.33, hra: 33.33, other: 33.34 });
    expect(round2(out.reduce((s, e) => s + e.amount, 0))).toBe(100.01);
  });
  it("normalizeSplit falls back on bad input", () => {
    expect(normalizeSplit(null)).toEqual({ basic: 50, hra: 25, other: 25 });
    expect(normalizeSplit({ basic: -1, hra: 1, other: 1 })).toEqual({ basic: 50, hra: 25, other: 25 });
    expect(normalizeSplit({ basic: 60, hra: 20, other: 20 })).toEqual({ basic: 60, hra: 20, other: 20 });
  });
});

describe("statutory placeholders", () => {
  it("PF 12% of basic", () => expect(computePf(10000)).toBe(1200));
  it("PT threshold", () => {
    expect(computePt(20000)).toBe(0);
    expect(computePt(20001)).toBe(200);
  });
  it("TDS threshold", () => {
    expect(computeTds(50000)).toBe(0);
    expect(computeTds(60000)).toBe(3000);
  });
});
