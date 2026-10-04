/** Pure payroll calculation helpers (no DB access). Money is rounded to 2 decimals per line. */

export const STATUTORY_NOTE = "Placeholder statutory calc — confirm with client";

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

const DAY_MS = 86400000;

/** Mon-Fri days of the month that are not holidays, as YYYY-MM-DD keys. */
export function workingDayKeys(year: number, month: number, holidayKeys: Set<string>): string[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const key = dayKey(d);
    if (!holidayKeys.has(key)) out.push(key);
  }
  return out;
}

/** No isPaid flag exists on LeaveType, so only types named/coded "Unpaid" or "LOP" are unpaid. */
export function isUnpaidLeaveType(t: { name?: string | null; code?: string | null }): boolean {
  return /\b(unpaid|lop)\b/i.test(`${t.name ?? ""} ${t.code ?? ""}`);
}

export type AttendanceCredit = { date: Date; status: string; checkInTime?: Date | null; checkOutTime?: Date | null };
export type LeaveSpan = { startDate: Date; endDate: Date; unpaid: boolean };

export type DayBreakdown = {
  expectedDays: number;
  presentDays: number; // full-credit attendance days
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  paidDays: number;
  workedHours: number;
};

/** Hours between punches; null when the punch is still open (no check-out). */
export function workedHoursOf(a: { checkInTime?: Date | null; checkOutTime?: Date | null }): number | null {
  if (!a.checkInTime || !a.checkOutTime) return null;
  const h = (a.checkOutTime.getTime() - a.checkInTime.getTime()) / 3600000;
  return Number.isFinite(h) && h > 0 ? h : 0;
}

/** Credit for one attendance record: open punch = full day; PRESENT below half the work hours = 0.5. */
export function attendanceCredit(a: AttendanceCredit, workHoursPerDay: number): number {
  if (a.status === "ON_LEAVE") return 1;
  if (a.status === "HALF_DAY") return 0.5;
  if (a.status !== "PRESENT") return 0;
  const hours = workedHoursOf(a);
  if (hours === null) return 1;
  return hours >= workHoursPerDay / 2 ? 1 : 0.5;
}

/**
 * Day breakdown per working day inside [activeStart, activeEnd] (YYYY-MM-DD keys).
 * Approved leave decides its days (paid = 1, unpaid = 0) so ON_LEAVE attendance is never double counted.
 * Otherwise attendance decides. Weekend/holiday punches are ignored because only working days are scanned.
 */
export function computeDayBreakdown(
  workingDays: string[],
  activeStart: string,
  activeEnd: string,
  attendances: AttendanceCredit[],
  leaves: LeaveSpan[],
  workHoursPerDay: number,
): DayBreakdown {
  const att = new Map<string, AttendanceCredit>();
  for (const a of attendances) att.set(dayKey(a.date), a);
  const leaveByDay = new Map<string, boolean>(); // day -> paid?
  for (const l of leaves) {
    for (let t = l.startDate.getTime(); t <= l.endDate.getTime(); t += DAY_MS) {
      const k = dayKey(new Date(t));
      // Any unpaid span on a day makes it unpaid.
      leaveByDay.set(k, (leaveByDay.get(k) ?? true) && !l.unpaid);
    }
  }
  const r: DayBreakdown = {
    expectedDays: 0,
    presentDays: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    absentDays: 0,
    paidDays: 0,
    workedHours: 0,
  };
  for (const k of workingDays) {
    if (k < activeStart || k > activeEnd) continue;
    r.expectedDays++;
    const a = att.get(k);
    if (a) r.workedHours += workedHoursOf(a) ?? 0;
    if (leaveByDay.has(k)) {
      if (leaveByDay.get(k)) r.paidLeaveDays++;
      else r.unpaidLeaveDays++;
      continue;
    }
    const credit = a ? attendanceCredit(a, workHoursPerDay) : 0;
    if (a && a.status === "ON_LEAVE") r.paidLeaveDays++;
    else if (credit === 1) r.presentDays++;
    else if (credit === 0.5) r.halfDays++;
    else r.absentDays++;
  }
  r.paidDays = r.presentDays + r.halfDays * 0.5 + r.paidLeaveDays;
  r.workedHours = round2(r.workedHours);
  return r;
}

/**
 * Fixed day-rate pay: perDay = baseGross / workingDaysPerMonth.
 * monthWorkingDays is the full-month working-day count; expectedDays is the working days inside the person's active window (joiners/leavers clipped), so a
 * partial-month employee earns at most expectedDays * perDay, minus unpaid days inside the window.
 */
export function computeDayRatePay(baseGross: number, workingDaysPerMonth: number, expectedDays: number, paidDays: number, monthWorkingDays: number) {
  const perDay = baseGross / Math.max(1, workingDaysPerMonth);
  const unpaidDays = Math.max(0, expectedDays - paidDays);
  // Full-month window pays the whole gross even when the month has fewer working days than the setting.
  const earnedBase = expectedDays >= monthWorkingDays ? baseGross : Math.min(baseGross, expectedDays * perDay);
  const earnedGross = round2(Math.max(0, earnedBase - unpaidDays * perDay));
  const lopAmount = round2(baseGross - earnedGross);
  return { perDayRate: round2(perDay), unpaidDays, lopAmount, earnedGross };
}

/** Keep only the last 4 characters visible. */
export const maskLast4 = (v?: string | null) => (v ? `${"*".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : v);

export type SalarySplit = { basic: number; hra: number; other: number };

export function normalizeSplit(raw: unknown): SalarySplit {
  const r = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : NaN);
  const basic = n(r.basic);
  const hra = n(r.hra);
  const other = n(r.other);
  if ([basic, hra, other].some(Number.isNaN)) return { basic: 50, hra: 25, other: 25 };
  return { basic, hra, other };
}

/** Earnings from the tenant salary split (percent of earned gross). When it sums to 100, "other" absorbs rounding. */
export function earningsFromSplit(earnedGross: number, split: SalarySplit): { code: string; name: string; amount: number }[] {
  const basic = round2((earnedGross * split.basic) / 100);
  const hra = round2((earnedGross * split.hra) / 100);
  const sumsTo100 = Math.abs(split.basic + split.hra + split.other - 100) < 1e-9;
  const other = sumsTo100 ? Math.max(0, round2(earnedGross - basic - hra)) : round2((earnedGross * split.other) / 100);
  return [
    { code: "BASIC", name: "Basic Salary", amount: basic },
    { code: "HRA", name: "House Rent Allowance", amount: hra },
    { code: "OTHER", name: "Other Allowances", amount: other },
  ];
}

// ---- Statutory deductions: PLACEHOLDER formulas, unchanged from the original; confirm with client. ----
export const computePf = (basicPay: number): number => Math.round(basicPay * 0.12);
export const computePt = (baseGross: number): number => (baseGross > 20000 ? 200 : 0);
export const computeTds = (baseGross: number): number => (baseGross > 50000 ? Math.round(baseGross * 0.05) : 0);
