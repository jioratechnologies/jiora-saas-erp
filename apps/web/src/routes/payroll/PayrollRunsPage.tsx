import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Play,
  CheckCircle,
  Download,
  AlertCircle,
  Users,
  Eye,
  Calendar,
  Send,
  Building,
  CreditCard,
} from "lucide-react";
import { api } from "../../api/client";
import { useMe } from "../../auth/use-me";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Modal } from "../../components/ui/modal";
import { QueryState } from "../../components/query-state";
import { toast } from "../../components/ui/toast";
import { exportToCsv } from "../../lib/csv-export";

interface PayrollRun {
  id: string;
  year: number;
  month: number;
  title: string;
  status: "DRAFT" | "CALCULATED" | "APPROVED" | "DISBURSED";
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedStaffCount: number;
  approvedBy?: string;
  approvedAt?: string;
  disbursedAt?: string;
  notes?: string;
  createdAt: string;
  _count?: { payslips: number };
}

interface Payslip {
  id: string;
  personId: string;
  year: number;
  month: number;
  totalWorkingDays: number;
  presentDays: number;
  lopDays: number;
  earnings: any[];
  deductions: any[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paymentStatus: "PENDING" | "PAID";
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
    designation?: { name: string };
    bankAccount?: string;
    bankIfsc?: string;
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function PayrollRunsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canManagePayroll = me?.permissionKeys?.includes("payroll.run.manage");

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [runNotes, setRunNotes] = useState("");

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Queries
  const { data: runs, isLoading: loadingRuns, isError: errRuns, error: runsError, refetch: refetchRuns } = useQuery({
    queryKey: ["payroll", "runs", selectedYear],
    queryFn: () => api.get<PayrollRun[]>(`/payroll/runs?year=${selectedYear}`),
  });

  const { data: selectedRun, isLoading: loadingSelectedRun, refetch: refetchSelectedRun } = useQuery({
    queryKey: ["payroll", "runs", "detail", selectedRunId],
    queryFn: () => api.get<PayrollRun & { payslips: Payslip[] }>(`/payroll/runs/${selectedRunId}`),
    enabled: !!selectedRunId,
  });

  // Mutations
  const calculateMutation = useMutation({
    mutationFn: (data: any) => api.post("/payroll/runs/calculate", data),
    onSuccess: (res: any) => {
      toast.success(`Payroll calculated for ${res.processedStaffCount || 0} employees.`);
      queryClient.invalidateQueries({ queryKey: ["payroll", "runs"] });
      setCalcModalOpen(false);
      setSelectedRunId(res.id);
      setDetailModalOpen(true);
    },
    onError: (err: any) => toast.error(err.message || "Failed to calculate payroll."),
  });

  const statusMutation = useMutation({
    mutationFn: ({ runId, status }: { runId: string; status: string }) =>
      api.patch(`/payroll/runs/${runId}/status`, { status }),
    onSuccess: (_, vars) => {
      toast.success(`Payroll run status updated to ${vars.status}.`);
      queryClient.invalidateQueries({ queryKey: ["payroll", "runs"] });
      refetchSelectedRun();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status."),
  });

  const handleOpenDetail = (runId: string) => {
    setSelectedRunId(runId);
    setDetailModalOpen(true);
  };

  const handleExportRunCsv = () => {
    if (!selectedRun || !selectedRun.payslips || selectedRun.payslips.length === 0) {
      toast.error("No payslips in this run to export.");
      return;
    }
    const rows = selectedRun.payslips.map((p) => ({
      "Employee Name": `${p.person.firstName} ${p.person.lastName}`,
      "Email": p.person.email,
      "Department": p.person.department?.name || "N/A",
      "Designation": p.person.designation?.name || "N/A",
      "Total Working Days": p.totalWorkingDays,
      "Present Days": p.presentDays,
      "Loss of Pay (LOP) Days": p.lopDays,
      "Gross Pay (INR)": p.grossPay,
      "Total Deductions (INR)": p.totalDeductions,
      "Net Salary (INR)": p.netPay,
      "Payment Status": p.paymentStatus,
      "Bank Account": p.person.bankAccount || "N/A",
      "Bank IFSC": p.person.bankIfsc || "N/A",
    }));
    exportToCsv(`Payroll_Register_${selectedRun.year}_${selectedRun.month}`, rows);
    toast.success("Payroll register exported.");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Monthly Payroll Runs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Attendance-linked monthly payroll calculation, loss-of-pay deductions, manager approvals, and disbursement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            options={[
              { label: "2026", value: "2026" },
              { label: "2025", value: "2025" },
            ]}
            className="w-28"
          />
          {canManagePayroll && (
            <Button size="sm" onClick={() => setCalcModalOpen(true)} className="gap-2 text-xs">
              <Play className="h-3.5 w-3.5" />
              Run Payroll
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs font-semibold text-muted-foreground">Total Runs ({selectedYear})</div>
          <div className="text-2xl font-bold text-foreground mt-1">{runs?.length ?? 0}</div>
        </Card>
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs font-semibold text-muted-foreground">Disbursed Cycles</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {runs?.filter((r) => r.status === "DISBURSED").length ?? 0}
          </div>
        </Card>
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs font-semibold text-muted-foreground">Pending Approval</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {runs?.filter((r) => r.status === "CALCULATED").length ?? 0}
          </div>
        </Card>
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs font-semibold text-muted-foreground">Active Employees</div>
          <div className="text-2xl font-bold text-primary mt-1">
            {runs?.[0]?.processedStaffCount ?? "—"}
          </div>
        </Card>
      </div>

      {/* Runs Table */}
      <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-semibold">Payroll History</CardTitle>
          <CardDescription className="text-xs">
            Monthly runs generated from employee daily attendance, leaves, and salary structures.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState
            isLoading={loadingRuns}
            error={runsError}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="py-3 px-4 text-left font-semibold">Payroll Cycle</th>
                    <th className="py-3 px-4 text-center font-semibold">Staff Count</th>
                    <th className="py-3 px-4 text-right font-semibold">Total Gross</th>
                    <th className="py-3 px-4 text-right font-semibold">Deductions</th>
                    <th className="py-3 px-4 text-right font-semibold">Net Payout</th>
                    <th className="py-3 px-4 text-center font-semibold">Status</th>
                    <th className="py-3 px-4 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {(runs || []).map((r) => {
                    const statusVariant =
                      r.status === "DISBURSED" ? "success" : r.status === "APPROVED" ? "default" : "secondary";
                    return (
                      <tr key={r.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{r.title}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {MONTH_NAMES[r.month - 1]} {r.year}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-foreground">
                          {r.processedStaffCount} Employees
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">
                          ₹{r.totalGross.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                          -₹{r.totalDeductions.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-foreground">
                          ₹{r.totalNet.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={statusVariant}>{r.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetail(r.id)}
                            className="h-7 text-[11px] px-2.5 gap-1.5"
                          >
                            <Eye className="h-3 w-3" />
                            Review Run
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </QueryState>
        </CardContent>
      </Card>

      {/* Modal: Calculate Payroll */}
      <Modal
        isOpen={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        title="Execute Monthly Payroll Calculation"
        description="Cross-references employee check-ins, unapproved absences for LOP, and active advance recoveries."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            calculateMutation.mutate({
              year: runYear,
              month: runMonth,
              notes: runNotes,
            });
          }}
          className="space-y-4 pt-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Payroll Month</label>
              <Select
                value={String(runMonth)}
                onChange={(e) => setRunMonth(parseInt(e.target.value, 10))}
                options={MONTH_NAMES.map((name, idx) => ({ label: name, value: String(idx + 1) }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Payroll Year</label>
              <Select
                value={String(runYear)}
                onChange={(e) => setRunYear(parseInt(e.target.value, 10))}
                options={[
                  { label: "2026", value: "2026" },
                  { label: "2025", value: "2025" },
                ]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Run Notes / Remarks (Optional)</label>
            <Input
              placeholder="e.g. Standard monthly calculation with LOP deductions"
              value={runNotes}
              onChange={(e) => setRunNotes(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="rounded-xl p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-primary" />
              Automated Attendance-Linked Deductions:
            </p>
            <p>• Employees with missing check-ins or unapproved leaves will receive automated Loss of Pay (LOP) prorations.</p>
            <p>• Active salary advance monthly repayments will be deducted automatically.</p>
            <p>• Unpaid volunteers are excluded automatically.</p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setCalcModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={calculateMutation.isPending}>
              {calculateMutation.isPending ? "Calculating…" : "Run Calculation"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Run Details & Payslips Review */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedRun?.title || "Payroll Run Review"}
        description={`Cycle: ${selectedRun ? MONTH_NAMES[selectedRun.month - 1] : ""} ${selectedRun?.year} | Status: ${selectedRun?.status}`}
        maxWidth="xl"
      >
        <div className="space-y-4 pt-2">
          {/* Action & Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Gross: </span>
                <span className="font-bold text-foreground">₹{selectedRun?.totalGross.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Deductions: </span>
                <span className="font-bold text-rose-600 dark:text-rose-400">-₹{selectedRun?.totalDeductions.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Net Payout: </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{selectedRun?.totalNet.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportRunCsv} className="h-8 text-xs gap-1.5">
                <Download className="h-3 w-3" />
                Export CSV
              </Button>

              {canManagePayroll && selectedRun?.status === "CALCULATED" && (
                <Button
                  size="sm"
                  onClick={() => statusMutation.mutate({ runId: selectedRun.id, status: "APPROVED" })}
                  disabled={statusMutation.isPending}
                  className="h-8 text-xs gap-1.5"
                >
                  <CheckCircle className="h-3 w-3" />
                  Approve Payroll
                </Button>
              )}

              {canManagePayroll && selectedRun?.status === "APPROVED" && (
                <Button
                  size="sm"
                  onClick={() => statusMutation.mutate({ runId: selectedRun.id, status: "DISBURSED" })}
                  disabled={statusMutation.isPending}
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="h-3 w-3" />
                  Disburse & Mark Paid
                </Button>
              )}
            </div>
          </div>

          {/* Payslips table */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto max-h-[360px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3 text-left font-semibold">Staff Member</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Days (Pres / LOP)</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Gross</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Deductions</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Net Pay</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {selectedRun?.payslips?.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-foreground">
                        {p.person.firstName} {p.person.lastName}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{p.person.department?.name || "General"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-medium text-foreground">{p.presentDays}</span>
                      <span className="text-muted-foreground"> / {p.totalWorkingDays}</span>
                      {p.lopDays > 0 && (
                        <span className="ml-1 text-rose-600 font-bold">({p.lopDays} LOP)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-foreground">
                      ₹{p.grossPay.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-600">
                      -₹{p.totalDeductions.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{p.netPay.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={p.paymentStatus === "PAID" ? "success" : "secondary"}>
                        {p.paymentStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setDetailModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
