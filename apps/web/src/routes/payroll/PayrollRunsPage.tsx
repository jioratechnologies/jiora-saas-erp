import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Gift,
  Play,
  RefreshCw,
  Send,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { useMe } from "../../auth/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Modal } from "../../components/ui/modal";
import { Skeleton } from "../../components/ui/skeleton";
import { SearchInput } from "../../components/ui/search-input";
import { Pagination } from "../../components/ui/pagination";
import { toast } from "../../components/ui/toast";
import { PageHeader } from "../../components/page-header";
import { SalaryVoucherDialog, type PayslipDetail } from "../../components/payroll/SalaryVoucher";
import { useConfirm } from "../../hooks/use-confirm";
import { usePagedQuery } from "../../lib/use-paged-query";
import { exportToExcel } from "../../lib/excel-export";
import { formatErrorMessage } from "../../lib/error-formatter";
import { fullName } from "../../lib/input-constraints";
import { cn } from "../../lib/utils";

type RunStatus = "DRAFT" | "CALCULATED" | "APPROVED" | "DISBURSED";
const STEPS: { key: RunStatus; label: string }[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "CALCULATED", label: "Calculated" },
  { key: "APPROVED", label: "Approved" },
  { key: "DISBURSED", label: "Disbursed" },
];

interface PayrollRun {
  id: string;
  year: number;
  month: number;
  status: RunStatus;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedStaffCount: number;
}

interface PersonName {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}

interface RunPayslip {
  id: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  earnings?: { code: string; amount: number }[];
  paymentStatus: "PENDING" | "PAID";
  person: PersonName & { department?: { name: string } | null; designation?: { name: string } | null };
}

interface SummaryRow extends PersonName {
  personId: string;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
  expectedDays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  paidDays: number;
  unpaidDays: number;
  workedHours: number;
  expectedHours: number;
  perDayRate: number;
  lopAmount: number;
  earnedGross: number;
}

type AdjType = "BONUS" | "ALLOWANCE" | "DEDUCTION";
interface Adjustment {
  id: string;
  personId: string;
  type: AdjType;
  amount: number;
  reason: string;
  person: PersonName;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Bonus + allowance adjustments included in a payslip's earnings. */
const additionsOf = (p: { earnings?: { code: string; amount: number }[] }) =>
  (p.earnings ?? []).filter((e) => e.code === "BONUS" || e.code === "ALLOWANCE").reduce((sum, e) => sum + e.amount, 0);

const inr = (n: number | undefined | null) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

const ADJ_OPTIONS = [
  { value: "BONUS", label: "Bonus" },
  { value: "ALLOWANCE", label: "Allowance" },
  { value: "DEDUCTION", label: "Deduction" },
];

export function PayrollRunsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: me } = useMe();
  const canManage = Boolean(me?.permissionKeys?.includes("payroll.run.manage"));
  const canRead = canManage || Boolean(me?.permissionKeys?.includes("payroll.run.read"));

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [adjOpen, setAdjOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const shift = (d: number) => {
    const idx = year * 12 + (month - 1) + d;
    setYear(Math.floor(idx / 12));
    setMonth((idx % 12) + 1);
  };

  // ── Section A: attendance & pay ────────────────────────────────────────────
  const summary = usePagedQuery<SummaryRow>({
    key: ["payroll", "attendance-summary", year, month],
    path: "/payroll/runs/attendance-summary",
    params: { year, month, search },
    pageSize: 10,
    enabled: canRead,
  });

  const exportSummary = async () => {
    setExporting(true);
    try {
      const all = await summary.fetchAll();
      if (all.length === 0) {
        toast.error("Nothing to export.");
        return;
      }
      await exportToExcel(
        `Attendance_Pay_${year}_${String(month).padStart(2, "0")}`,
        all.map((r) => ({
          Employee: fullName(r),
          Department: r.department?.name ?? "",
          Designation: r.designation?.name ?? "",
          "Expected days": r.expectedDays,
          Present: r.presentDays,
          "Half days": r.halfDays,
          "Paid leave": r.paidLeaveDays,
          "Unpaid leave": r.unpaidLeaveDays,
          Absent: r.absentDays,
          "Paid days": r.paidDays,
          "Unpaid days": r.unpaidDays,
          "Hours worked": r.workedHours,
          "Expected hours": r.expectedHours,
          "Per-day rate": r.perDayRate,
          "LOP amount": r.lopAmount,
          "Earned gross": r.earnedGross,
        })),
        undefined,
        "Attendance & pay",
      );
    } catch (err) {
      toast.error(formatErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  // ── Section B: run ────────────────────────────────────────────────────────
  const runsQ = useQuery({
    queryKey: ["payroll", "runs", year],
    queryFn: () => api.get<PayrollRun[]>(`/payroll/runs?year=${year}`),
    enabled: canRead,
  });
  const run = runsQ.data?.find((r) => r.month === month);

  const runQ = useQuery({
    queryKey: ["payroll", "runs", "detail", run?.id],
    queryFn: () => api.get<PayrollRun & { payslips: RunPayslip[] }>(`/payroll/runs/${run!.id}`),
    enabled: canRead && !!run?.id,
  });
  const payslips = runQ.data?.payslips ?? [];
  const totalAdditions = payslips.reduce((sum, p) => sum + additionsOf(p), 0);

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ["payroll"] });

  const calcM = useMutation({
    mutationFn: () => api.post<PayrollRun>("/payroll/runs/calculate", { year, month }),
    onSuccess: (res) => {
      toast.success(`Payroll calculated for ${res?.processedStaffCount ?? 0} employees.`);
      void refreshAll();
    },
    onError: (err) => toast.error(formatErrorMessage(err)),
  });

  const statusM = useMutation({
    mutationFn: (status: RunStatus) => api.patch(`/payroll/runs/${run!.id}/status`, { status }),
    onSuccess: (_r, status) => {
      toast.success(status === "APPROVED" ? "Payroll approved." : "Payroll marked as disbursed.");
      void refreshAll();
    },
    onError: (err) => toast.error(formatErrorMessage(err)),
  });

  const status: RunStatus = run?.status ?? "DRAFT";
  const stepIdx = run ? STEPS.findIndex((s) => s.key === status) : -1;
  const locked = status === "APPROVED" || status === "DISBURSED";
  const busy = calcM.isPending || statusM.isPending;

  const exportRegister = async () => {
    if (!runQ.data || payslips.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    try {
      await exportToExcel(
        `Payroll_Register_${year}_${String(month).padStart(2, "0")}`,
        payslips.map((p) => ({
          Employee: fullName(p.person),
          Department: p.person.department?.name ?? "",
          Designation: p.person.designation?.name ?? "",
          "Gross earned": p.grossPay,
          "Additions (bonus & allowances)": additionsOf(p),
          Deductions: p.totalDeductions,
          "Net pay": p.netPay,
          "Payment status": p.paymentStatus,
        })),
        undefined,
        "Payroll register",
      );
    } catch (err) {
      toast.error(formatErrorMessage(err));
    }
  };

  // ── Voucher ───────────────────────────────────────────────────────────────
  const orgQ = useQuery({
    queryKey: ["org", "theme"],
    queryFn: () => api.get<{ name: string; logoUrl: string | null }>("/admin/org"),
    enabled: !!voucherId,
    staleTime: 5 * 60 * 1000,
  });
  const voucherQ = useQuery({
    queryKey: ["payroll", "payslip", voucherId],
    queryFn: () => api.get<PayslipDetail>(`/payroll/runs/payslips/${voucherId}`),
    enabled: !!voucherId,
  });

  // ── Section C: adjustments ────────────────────────────────────────────────
  const adjQ = useQuery({
    queryKey: ["payroll", "adjustments", year, month],
    queryFn: () => api.get<Adjustment[]>(`/payroll/adjustments?year=${year}&month=${month}`),
    enabled: canRead,
  });

  const delAdj = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/adjustments/${id}`),
    onSuccess: () => {
      toast.success("Adjustment removed.");
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (err) => toast.error(formatErrorMessage(err)),
  });

  const onDeleteAdj = async (a: Adjustment) => {
    const ok = await confirm({
      title: "Remove adjustment?",
      description: `${fullName(a.person)} - ${inr(a.amount)}`,
      confirmLabel: "Remove",
    });
    if (ok) delAdj.mutate(a.id);
  };

  if (me && !canRead) {
    return <div className="p-6 text-sm text-muted-foreground">You do not have permission to perform this action.</div>;
  }

  const primary = (() => {
    if (!canManage) return null;
    if (status === "APPROVED")
      return (
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => statusM.mutate("DISBURSED")}
        >
          <Send className="h-3.5 w-3.5" /> Disburse
        </Button>
      );
    if (status === "DISBURSED") return null;
    return (
      <>
        {status === "CALCULATED" && (
          <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={busy} onClick={() => statusM.mutate("APPROVED")}>
            <CheckCircle className="h-3.5 w-3.5" /> Approve
          </Button>
        )}
        <Button
          size="sm"
          variant={status === "CALCULATED" ? "outline" : "default"}
          className="h-8 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => calcM.mutate()}
        >
          {run ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {run ? "Recalculate" : "Calculate"}
        </Button>
      </>
    );
  })();

  return (
    <div className="space-y-4 md:space-y-6 w-full">
      <PageHeader
        title="Payroll"
        icon={Banknote}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-xs font-semibold">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* A: Attendance & pay */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="py-2.5 px-4 border-b border-border flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Attendance &amp; pay</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="h-8 sm:w-56"
            />
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0" disabled={exporting} onClick={exportSummary}>
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground bg-muted/40">
                  <th className="py-2.5 px-3 text-left font-semibold">Employee</th>
                  <th className="py-2.5 px-2 text-center font-semibold">Expected</th>
                  <th className="py-2.5 px-2 text-center font-semibold">Present</th>
                  <th className="py-2.5 px-2 text-center font-semibold">Leave</th>
                  <th className="py-2.5 px-2 text-center font-semibold">Paid</th>
                  <th className="py-2.5 px-2 text-center font-semibold">Unpaid</th>
                  <th className="py-2.5 px-2 text-center font-semibold">Hours</th>
                  <th className="py-2.5 px-2 text-right font-semibold">Per day</th>
                  <th className="py-2.5 px-2 text-right font-semibold">LOP</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }).map((__, j) => (
                          <td key={j} className="py-3 px-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : summary.items.map((r) => (
                      <tr key={r.personId} className="hover:bg-muted/40">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-foreground">{fullName(r)}</div>
                          <div className="text-[10px] text-muted-foreground">{r.department?.name ?? "-"}</div>
                        </td>
                        <td className="py-2 px-2 text-center">{r.expectedDays}</td>
                        <td className="py-2 px-2 text-center">{r.presentDays}</td>
                        <td className="py-2 px-2 text-center">{r.paidLeaveDays + r.unpaidLeaveDays}</td>
                        <td className="py-2 px-2 text-center font-medium">{r.paidDays}</td>
                        <td className={cn("py-2 px-2 text-center", r.unpaidDays > 0 && "text-destructive font-bold")}>
                          {r.unpaidDays}
                        </td>
                        <td className="py-2 px-2 text-center">{r.workedHours}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{inr(r.perDayRate)}</td>
                        <td className="py-2 px-2 text-right text-destructive">{r.lopAmount > 0 ? `-${inr(r.lopAmount)}` : "-"}</td>
                        <td className="py-2 px-3 text-right font-bold">{inr(r.earnedGross)}</td>
                      </tr>
                    ))}
                {!summary.isLoading && summary.items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-muted-foreground">
                      {summary.error ? formatErrorMessage(summary.error) : "No records."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={summary.page}
            totalPages={summary.totalPages}
            totalItems={summary.total}
            pageSize={summary.pageSize}
            onPageChange={summary.setPage}
            onPageSizeChange={summary.setPageSize}
          />
        </CardContent>
      </Card>

      {/* B: Payroll run */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="py-2.5 px-4 border-b border-border flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Payroll run</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={payslips.length === 0}
              onClick={exportRegister}
            >
              <Download className="h-3.5 w-3.5" /> Export register
            </Button>
            {primary}
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <ol className="flex items-center">
            {STEPS.map((s, i) => {
              const done = i < stepIdx || (i === stepIdx && s.key === "DISBURSED");
              const current = i === stepIdx && !done;
              return (
                <li key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold shrink-0",
                        done && "bg-primary border-primary text-primary-foreground",
                        current && "border-primary text-primary",
                        !done && !current && "border-border text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={cn("text-[11px] font-medium hidden sm:inline", (done || current) ? "text-foreground" : "text-muted-foreground")}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <div className={cn("h-px flex-1 mx-2", i < stepIdx ? "bg-primary" : "bg-border")} />}
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-muted-foreground sm:hidden">{run ? STEPS[stepIdx]?.label : "Not calculated"}</p>

          {run && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl border border-border p-2.5">
                <span className="text-[10px] text-muted-foreground block">Gross</span>
                <b>{inr(run.totalGross)}</b>
              </div>
              <div className="rounded-xl border border-border p-2.5">
                <span className="text-[10px] text-muted-foreground block">Additions</span>
                <b className="text-emerald-600 dark:text-emerald-400">+{inr(totalAdditions)}</b>
              </div>
              <div className="rounded-xl border border-border p-2.5">
                <span className="text-[10px] text-muted-foreground block">Deductions</span>
                <b className="text-destructive">{inr(run.totalDeductions)}</b>
              </div>
              <div className="rounded-xl border border-border p-2.5">
                <span className="text-[10px] text-muted-foreground block">Net</span>
                <b>{inr(run.totalNet)}</b>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground bg-muted/40">
                  <th className="py-2.5 px-3 text-left font-semibold">Employee</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Gross earned</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Additions</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Deductions</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Net</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runsQ.isLoading || runQ.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="py-3 px-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : payslips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {runsQ.error || runQ.error ? formatErrorMessage(runsQ.error ?? runQ.error) : "No payslips yet."}
                    </td>
                  </tr>
                ) : (
                  payslips.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setVoucherId(p.id)}>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">{fullName(p.person)}</div>
                        <div className="text-[10px] text-muted-foreground">{p.person.department?.name ?? "-"}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right">{inr(p.grossPay)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                        {additionsOf(p) > 0 ? `+${inr(additionsOf(p))}` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-destructive">-{inr(p.totalDeductions)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{inr(p.netPay)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={p.paymentStatus === "PAID" ? "success" : "secondary"} size="sm">
                          {p.paymentStatus === "PAID" ? "Paid" : "Pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* C: Bonus & adjustments */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="py-2.5 px-4 border-b border-border flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Bonus &amp; adjustments</CardTitle>
          {canManage && !locked && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAdjOpen(true)}>
              <Gift className="h-3.5 w-3.5" /> Add bonus
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {adjQ.isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (adjQ.data ?? []).length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {adjQ.error ? formatErrorMessage(adjQ.error) : "No adjustments this month."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {adjQ.data!.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{fullName(a.person)}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{a.reason}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={a.type === "DEDUCTION" ? "destructive" : "success"} size="sm">
                      {ADJ_OPTIONS.find((o) => o.value === a.type)?.label}
                    </Badge>
                    <span className="font-bold w-20 text-right">{inr(a.amount)}</span>
                    {canManage && !locked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        aria-label="Remove"
                        disabled={delAdj.isPending}
                        onClick={() => onDeleteAdj(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AdjustmentModal
        isOpen={adjOpen}
        onClose={() => setAdjOpen(false)}
        year={year}
        month={month}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["payroll"] })}
      />

      <SalaryVoucherDialog
        isOpen={!!voucherId}
        onClose={() => setVoucherId(null)}
        payslip={voucherQ.data}
        loading={voucherQ.isLoading}
        org={{ name: orgQ.data?.name ?? "Organisation", logoUrl: orgQ.data?.logoUrl }}
      />
    </div>
  );
}

function AdjustmentModal({
  isOpen,
  onClose,
  year,
  month,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  onSaved: () => void;
}) {
  const [personId, setPersonId] = useState("");
  const [type, setType] = useState<AdjType>("BONUS");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // People list comes from the attendance summary (same permission as this page).
  const people = useQuery({
    queryKey: ["payroll", "adjustment-people", year, month],
    queryFn: async () => {
      const out: SummaryRow[] = [];
      for (let p = 1; p <= 50; p++) {
        const res = await api.get<{ items: SummaryRow[]; total: number }>(
          `/payroll/runs/attendance-summary?year=${year}&month=${month}&page=${p}&pageSize=100`,
        );
        out.push(...res.items);
        if (res.items.length === 0 || out.length >= res.total) break;
      }
      return out;
    },
    enabled: isOpen,
    staleTime: 60 * 1000,
  });

  const save = useMutation({
    mutationFn: () =>
      api.post("/payroll/adjustments", { personId, year, month, type, amount: Number(amount), reason: reason.trim() }),
    onSuccess: () => {
      toast.success("Adjustment added.");
      onSaved();
      setPersonId("");
      setAmount("");
      setReason("");
      onClose();
    },
    onError: (err) => toast.error(formatErrorMessage(err)),
  });

  const valid = !!personId && Number(amount) > 0 && reason.trim().length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add bonus" description={`${MONTH_NAMES[month - 1]} ${year}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <Select
          label="Employee"
          searchable
          placeholder={people.isLoading ? "Loading…" : "Select employee"}
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          options={(people.data ?? []).map((p) => ({
            value: p.personId,
            label: fullName(p),
            description: p.department?.name ?? undefined,
          }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as AdjType)}
            options={ADJ_OPTIONS}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">Amount (₹)</label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-foreground">Reason</label>
          <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!valid || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
