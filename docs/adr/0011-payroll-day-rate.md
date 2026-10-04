# ADR 0011 — Day-rate payroll calculation

## Context

Indian organizations commonly pay staff on a monthly basis with a specified gross salary, yet compensate for partial month work (joining mid-month, exit, half-days, or approved leave) on a pro-rata day-rate basis. The day rate is simply monthly gross divided by working days in the month.

Payment for a day depends on attendance: paid leave (1 day), unpaid leave (0 days), present with sufficient worked hours (1 day), half-day (0.5 days), absent or no punch (0 days). This requires accurate daily attendance data, a fixed monthly working-day count, and organization-specific work hours per day.

Previous iterations either used simplistic pro-rata (gross ÷ 30) or decoupled salary calculation from attendance. Clients need both accuracy and flexibility: some have 22 working days/month with 10 work hours/day; others differ.

## Decision

Payroll day-rate calculation is driven by:

1. **Tenant work schedule** (`Tenant.workingDaysPerMonth`, default 22; `workHoursPerDay`, default 8; `salarySplit`, e.g. {basic: 50%, hra: 25%, other: 25%}). Updated via `PATCH /admin/org/work-schedule`.
2. **Per-day rate**: `monthlyGross ÷ workingDaysPerMonth`. Computed on demand from the current monthly gross (not stored).
3. **Daily credit logic**: For each day Mon–Fri, excluding holidays:
   - Approved paid leave: 1 day credit
   - Approved unpaid leave: 0 days credit
   - Present with actual worked hours ≥ half of `workHoursPerDay`: 1 day credit
   - Half-day or partial attendance: 0.5 days credit
   - Absent or no punch: 0 days credit
   - Open punch (no checkout yet): full day credit
4. **Earned gross calculation**:
   ```
   earnedGross = max(0, (W >= M ? gross : min(gross, W × perDay)) - unpaidDays × perDay)
   ```
   where W = working days in joined/exit window, M = full-month working days. This handles mid-month joiners, exits, and ensures earned gross does not exceed monthly gross.
5. **Earnings breakdown**: Split `earnedGross` by org `salarySplit` percentages (basic, HRA, other). No per-component calculation—proportional distribution.
6. **Statutory deductions**: PF, PT, TDS remain coded placeholders pending client confirmation.

Payroll status flow is strict: `DRAFT → CALCULATED → APPROVED → DISBURSED`. Payroll adjustments (bonuses, allowances, deductions) are recorded in `PayrollAdjustment` but are blocked after a run is approved.

## Why not use attendance percentage or 30-day pro-rata

- **Attendance %**: Conflates days present with days paid. Unpaid leave should not reduce pay below a fixed threshold; a statutory holiday should not inflate pay if the employee was on leave.
- **30-day pro-rata**: Ignores organization-specific working-day count (22, 20, etc.) and loses accuracy. A 22-day month should not be treated as 30 days.

## Why not bundle statutory calculations

- Statutory deductions (PF, PT, TDS) vary by state, regime, and exemption. Coding them as "correct" exposes the system to compliance errors.
- **Solution**: Placeholder calculation with a clear audit comment: "Placeholder statutory calc—confirm with client." Payroll runs flag these and require a compliance sign-off before disbursement.

## Consequences

- **Accurate pro-rata**: Mid-month joiners, exits, and part-day work are correctly compensated.
- **Flexible work schedules**: Tenants can configure working days and hours per day; payroll adapts automatically.
- **Attendance-linked disbursement**: Payroll is tied to daily attendance records, reducing disputes and supporting honest leave reconciliation.
- **Database migrations**: `20261005000000_org_work_schedule` seeds `Tenant.workingDaysPerMonth`, `workHoursPerDay`, `salarySplit`. `20261006000000_payroll_adjustments` adds `PayrollAdjustment` table.
- **Schema changes**: `EmployeeSalaryAssignment` retains `perDayRate` (recalculated on salary changes). `Payslip` stores `workingDaysInMonth`, `paidLeaves`, `unpaidLeaves`, `presentDays` (recalculated on each run).
- **Known open**: Maker-checker audit log should track `calculatedBy` user; historical month payroll uses current gross (to be frozen in a future release); mid-month revision recalculates the entire month.

---
