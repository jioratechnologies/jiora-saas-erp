import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Download, Plus } from "lucide-react";
import { api } from "../../api/client";
import { useMe } from "../../auth/use-me";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Modal } from "../../components/ui/modal";
import { SearchInput } from "../../components/ui/search-input";
import { QueryState } from "../../components/query-state";
import { toast } from "../../components/ui/toast";
import { exportToExcel } from "../../lib/excel-export";
import { formatErrorMessage } from "../../lib/error-formatter";
import { fullName } from "../../lib/input-constraints";
import { PageHeader } from "../../components/page-header";
import { Pagination, usePagination } from "../../components/ui/pagination";

interface StaffRow {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  designation?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  salaryAssignment?: {
    baseGross: number;
    ctc: number;
    paymentMode: string;
    bankAccount?: string | null;
    bankIfsc?: string | null;
    panNumber?: string | null;
    effectiveFrom: string;
  } | null;
}

interface SalaryRevision {
  id: string;
  personId: string;
  oldGross?: number | null;
  newGross: number;
  incrementAmount: number;
  effectiveDate: string;
  remarks?: string | null;
  person: { id: string; firstName: string; middleName?: string | null; lastName: string };
}

interface SalarySettings {
  workingDaysPerMonth: number;
  workHoursPerDay: number;
  salarySplit: { basic: number; hra: number; other: number };
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const today = () => new Date().toISOString().split("T")[0];

export function CompensationPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canManage = me?.permissionKeys?.includes("payroll.salary.manage");

  const [tab, setTab] = useState<"compensation" | "increments">("compensation");
  const [search, setSearch] = useState("");

  // Set/Edit salary modal
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [target, setTarget] = useState<StaffRow | null>(null);
  const [grossInput, setGrossInput] = useState("");
  const [ctcInput, setCtcInput] = useState("");
  const [ctcTouched, setCtcTouched] = useState(false);
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [panNumber, setPanNumber] = useState("");

  // Increment modal
  const [incOpen, setIncOpen] = useState(false);
  const [incPersonId, setIncPersonId] = useState("");
  const [incAmount, setIncAmount] = useState("");
  const [incDate, setIncDate] = useState(today());
  const [incRemarks, setIncRemarks] = useState("");

  const staffQ = useQuery({
    queryKey: ["payroll", "salary", "staff"],
    queryFn: () => api.get<StaffRow[]>("/payroll/salary/staff"),
  });
  const revisionsQ = useQuery({
    queryKey: ["payroll", "salary", "revisions"],
    queryFn: () => api.get<SalaryRevision[]>("/payroll/salary/revisions"),
  });
  const settingsQ = useQuery({
    queryKey: ["payroll", "salary", "settings"],
    queryFn: () => api.get<SalarySettings>("/payroll/salary/settings"),
  });

  const staff = staffQ.data || [];
  const settings = settingsQ.data;
  const workingDays = settings?.workingDaysPerMonth || 22;

  const lastIncrement = useMemo(() => {
    const map = new Map<string, SalaryRevision>();
    // list is newest first; keep first real increment (has an old base) per person
    for (const r of revisionsQ.data || []) {
      if (r.oldGross == null || map.has(r.personId)) continue;
      map.set(r.personId, r);
    }
    return map;
  }, [revisionsQ.data]);

  const filtered = staff.filter((p) => {
    const q = search.toLowerCase();
    return fullName(p).toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.designation?.name || "").toLowerCase().includes(q);
  });
  const staffPage = usePagination(filtered, 10);
  const revisionPage = usePagination(revisionsQ.data || [], 10);

  const withSalary = staff.filter((p) => p.salaryAssignment);
  const totalMonthly = withSalary.reduce((s, p) => s + Number(p.salaryAssignment!.baseGross || 0), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payroll", "salary"] });
  };

  const assignMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/payroll/salary/assignments", data),
    onSuccess: () => {
      toast.success("Salary saved.");
      invalidate();
      setSalaryOpen(false);
    },
    onError: (err: unknown) => toast.error(formatErrorMessage(err)),
  });

  const incMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/payroll/salary/revisions", data),
    onSuccess: () => {
      toast.success("Increment recorded.");
      invalidate();
      setIncOpen(false);
    },
    onError: (err: unknown) => toast.error(formatErrorMessage(err)),
  });

  const openSalary = (p: StaffRow) => {
    const a = p.salaryAssignment;
    setTarget(p);
    setGrossInput(a ? String(a.baseGross) : "");
    setCtcInput(a ? String(a.ctc) : "");
    setCtcTouched(false);
    setPaymentMode(a?.paymentMode || "BANK_TRANSFER");
    setBankAccount(a?.bankAccount || "");
    setBankIfsc(a?.bankIfsc || "");
    setPanNumber(a?.panNumber || "");
    setSalaryOpen(true);
  };

  const openIncrement = (personId = "") => {
    setIncPersonId(personId);
    setIncAmount("");
    setIncDate(today());
    setIncRemarks("");
    setIncOpen(true);
  };

  const onGrossChange = (v: string) => {
    setGrossInput(v);
    if (!ctcTouched) {
      const g = parseFloat(v);
      setCtcInput(g > 0 ? String(Math.round(g * 12 * 100) / 100) : "");
    }
  };

  const submitSalary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    const gross = parseFloat(grossInput);
    if (!(gross > 0)) return toast.error("Please enter a valid monthly salary.");
    const ctc = parseFloat(ctcInput);
    if (ctcInput && !(ctc >= 0)) return toast.error("Please enter a valid annual CTC.");
    if (bankIfsc && !IFSC_RE.test(bankIfsc)) return toast.error("Please enter a valid IFSC code (for example HDFC0001234).");
    if (panNumber && !PAN_RE.test(panNumber)) return toast.error("Please enter a valid PAN number (for example ABCDE1234F).");
    assignMutation.mutate({
      personId: target.id,
      baseGross: gross,
      ctc: ctcInput ? ctc : undefined,
      paymentMode,
      bankAccount: bankAccount.trim(),
      bankIfsc: bankIfsc.trim(),
      panNumber: panNumber.trim(),
    });
  };

  const incPerson = staff.find((p) => p.id === incPersonId);
  const incOldGross = incPerson?.salaryAssignment?.baseGross ?? 0;
  const incNum = parseFloat(incAmount);
  const incNewGross = Number.isFinite(incNum) ? incOldGross + incNum : null;

  const submitIncrement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incPersonId) return toast.error("Please select a person.");
    if (!Number.isFinite(incNum) || incNum === 0) return toast.error("Please enter the increment amount.");
    if (incNewGross == null || incNewGross <= 0) return toast.error("The new salary must be greater than zero.");
    incMutation.mutate({
      personId: incPersonId,
      incrementAmount: incNum,
      effectiveDate: incDate,
      remarks: incRemarks.trim() || undefined,
    });
  };

  const exportRegister = () => {
    if (withSalary.length === 0) return toast.error("No compensation records to export.");
    exportToExcel(
      "Compensation_Register",
      withSalary.map((p) => {
        const a = p.salaryAssignment!;
        return {
          Name: fullName(p),
          Email: p.email,
          Designation: p.designation?.name || "N/A",
          "Monthly Gross (INR)": a.baseGross,
          "Annual CTC (INR)": a.ctc,
          "Per-day Rate (INR)": Math.round((a.baseGross / workingDays) * 100) / 100,
          "Payment Mode": a.paymentMode,
          "Bank Account": a.bankAccount || "N/A",
          "Bank IFSC": a.bankIfsc || "N/A",
          "PAN Number": a.panNumber || "N/A",
          "Last Increment (INR)": lastIncrement.get(p.id)?.incrementAmount ?? "N/A",
        };
      }),
    );
    toast.success("Compensation register exported.");
  };

  const split = settings?.salarySplit;
  const gPreview = parseFloat(grossInput);
  const part = (pct: number) => (gPreview > 0 ? inr((gPreview * pct) / 100) : "—");

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
      active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
    }`;

  const SalaryAction = ({ p }: { p: StaffRow }) =>
    canManage ? (
      <Button variant="outline" size="sm" onClick={() => openSalary(p)} className="h-7 text-xs px-2.5">
        {p.salaryAssignment ? "Edit salary" : "Set salary"}
      </Button>
    ) : null;

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6 w-full">
      <PageHeader
        icon={Banknote}
        title="Compensation"
        description="Monthly salary, annual CTC and increment history for your staff."
        badge={{ label: `${withSalary.length} Staff with salary`, variant: "outline" }}
        actions={
          <div className="flex items-center gap-2">
            {tab === "compensation" && (
              <Button variant="outline" size="sm" onClick={exportRegister} className="gap-1.5 text-xs rounded-xl h-8 px-2.5 sm:px-3">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export Register</span>
              </Button>
            )}
            {tab === "increments" && canManage && (
              <Button size="sm" onClick={() => openIncrement()} className="gap-1.5 text-xs rounded-xl shadow-sm h-8 px-2.5 sm:px-3">
                <Plus className="h-3.5 w-3.5" />
                <span>Give increment</span>
              </Button>
            )}
          </div>
        }
        stats={[
          { label: "Staff with salary", value: withSalary.length },
          { label: "Monthly Gross", value: inr(totalMonthly), color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Working days / month", value: workingDays, color: "text-primary" },
        ]}
      />

      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto no-scrollbar">
        <button onClick={() => setTab("compensation")} className={tabCls(tab === "compensation")}>Compensation</button>
        <button onClick={() => setTab("increments")} className={tabCls(tab === "increments")}>Increments</button>
      </div>

      {tab === "compensation" && (
        <div className="space-y-3">
          <SearchInput
            placeholder="Search by name, email, designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-sm"
          />
          <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <QueryState isLoading={staffQ.isLoading} error={staffQ.error}>
                {/* Mobile */}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 sm:hidden">
                  {filtered.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">No staff found.</div>
                  ) : (
                    staffPage.paginatedItems.map((p) => {
                      const a = p.salaryAssignment;
                      const inc = lastIncrement.get(p.id);
                      return (
                        <div key={p.id} className="p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-semibold text-xs text-foreground block truncate">{fullName(p)}</span>
                              <span className="text-[11px] text-muted-foreground truncate block">{p.designation?.name || "Staff"}</span>
                            </div>
                            {!a && <Badge variant="secondary" size="sm" className="shrink-0">Not set</Badge>}
                          </div>
                          {a && (
                            <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 text-[11px]">
                              <div><span className="text-[10px] text-muted-foreground block">Monthly gross</span><span className="font-bold text-foreground">{inr(a.baseGross)}</span></div>
                              <div><span className="text-[10px] text-muted-foreground block">Annual CTC</span><span className="text-emerald-600 font-semibold">{inr(a.ctc)}</span></div>
                              <div><span className="text-[10px] text-muted-foreground block">Per-day rate</span><span className="text-foreground">{inr(a.baseGross / workingDays)}</span></div>
                              <div><span className="text-[10px] text-muted-foreground block">Last increment</span><span className="text-foreground">{inc ? `${inc.incrementAmount >= 0 ? "+" : "-"}${inr(Math.abs(inc.incrementAmount))}` : "—"}</span></div>
                            </div>
                          )}
                          {canManage && (
                            <div className="flex justify-end pt-1"><SalaryAction p={p} /></div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-muted-foreground">
                        <th className="py-2.5 px-3.5 text-left font-semibold">Name</th>
                        <th className="py-2.5 px-3 text-left font-semibold">Designation</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Monthly gross</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Annual CTC</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Per-day rate</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Last increment</th>
                        {canManage && <th className="py-2.5 px-3 text-center font-semibold">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No staff found.</td></tr>
                      )}
                      {staffPage.paginatedItems.map((p) => {
                        const a = p.salaryAssignment;
                        const inc = lastIncrement.get(p.id);
                        return (
                          <tr key={p.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                            <td className="py-2 px-3.5">
                              <div className="font-semibold text-foreground">{fullName(p)}</div>
                              <div className="text-[10px] text-muted-foreground">{p.email}</div>
                            </td>
                            <td className="py-2 px-3 text-foreground">{p.designation?.name || "Staff"}</td>
                            {a ? (
                              <>
                                <td className="py-2 px-3 text-right font-semibold text-foreground">{inr(a.baseGross)}</td>
                                <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">{inr(a.ctc)}</td>
                                <td className="py-2 px-3 text-right text-foreground">{inr(a.baseGross / workingDays)}</td>
                                <td className="py-2 px-3 text-right text-muted-foreground">
                                  {inc ? `${inc.incrementAmount >= 0 ? "+" : "-"}${inr(Math.abs(inc.incrementAmount))}` : "—"}
                                </td>
                              </>
                            ) : (
                              <td colSpan={4} className="py-2 px-3 text-right"><Badge variant="secondary" size="sm">Not set</Badge></td>
                            )}
                            {canManage && <td className="py-2 px-3 text-center"><SalaryAction p={p} /></td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={staffPage.currentPage}
                  totalPages={staffPage.totalPages}
                  totalItems={staffPage.totalItems}
                  pageSize={staffPage.pageSize}
                  onPageChange={staffPage.setCurrentPage}
                  onPageSizeChange={staffPage.setPageSize}
                />
              </QueryState>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "increments" && (
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <QueryState isLoading={revisionsQ.isLoading} error={revisionsQ.error}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-muted-foreground">
                      <th className="py-2.5 px-3.5 text-left font-semibold">Date</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Person</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Old base</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Increment</th>
                      <th className="py-2.5 px-3 text-right font-semibold">New base</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
                    {(revisionsQ.data || []).length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No increments recorded yet.</td></tr>
                    )}
                    {revisionPage.paginatedItems.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                        <td className="py-2 px-3.5 text-muted-foreground">{r.effectiveDate?.substring(0, 10)}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">{fullName(r.person)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{r.oldGross == null ? "—" : inr(r.oldGross)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${r.incrementAmount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                          {r.incrementAmount >= 0 ? "+" : "-"}{inr(Math.abs(r.incrementAmount))}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-foreground">{inr(r.newGross)}</td>
                        <td className="py-2 px-3 text-muted-foreground">{r.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={revisionPage.currentPage}
                totalPages={revisionPage.totalPages}
                totalItems={revisionPage.totalItems}
                pageSize={revisionPage.pageSize}
                onPageChange={revisionPage.setCurrentPage}
                onPageSizeChange={revisionPage.setPageSize}
              />
            </QueryState>
          </CardContent>
        </Card>
      )}

      {/* Modal: Set / Edit salary */}
      <Modal
        isOpen={salaryOpen}
        onClose={() => setSalaryOpen(false)}
        title={`${target?.salaryAssignment ? "Edit" : "Set"} salary: ${target ? fullName(target) : ""}`}
        description="Monthly gross, annual CTC and payment details."
      >
        <form onSubmit={submitSalary} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Monthly gross (INR) *</label>
              <Input type="number" min="0" step="0.01" placeholder="e.g. 45000" value={grossInput} onChange={(e) => onGrossChange(e.target.value)} required className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Annual CTC (INR)</label>
              <Input type="number" min="0" step="0.01" value={ctcInput} onChange={(e) => { setCtcTouched(true); setCtcInput(e.target.value); }} className="h-9 text-xs" />
            </div>
          </div>

          {split && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-3 text-[11px]">
              <div className="font-semibold text-foreground mb-1.5">Monthly breakdown (organisation split)</div>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-muted-foreground block">Basic ({split.basic}%)</span><span className="font-semibold text-foreground">{part(split.basic)}</span></div>
                <div><span className="text-muted-foreground block">HRA ({split.hra}%)</span><span className="font-semibold text-foreground">{part(split.hra)}</span></div>
                <div><span className="text-muted-foreground block">Other ({split.other}%)</span><span className="font-semibold text-foreground">{part(split.other)}</span></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Payment mode</label>
              <Select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                options={[
                  { label: "Bank transfer (NEFT/RTGS)", value: "BANK_TRANSFER" },
                  { label: "Cheque", value: "CHEQUE" },
                  { label: "Cash", value: "CASH" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">PAN number</label>
              <Input placeholder="ABCDE1234F" maxLength={10} value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Bank account number</label>
              <Input placeholder="Account number" inputMode="numeric" value={bankAccount} onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Bank IFSC code</label>
              <Input placeholder="e.g. HDFC0001234" maxLength={11} value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} className="h-9 text-xs" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setSalaryOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={assignMutation.isPending}>{assignMutation.isPending ? "Saving…" : "Save salary"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Give increment */}
      <Modal isOpen={incOpen} onClose={() => setIncOpen(false)} title="Give increment" description="Add (or reduce) a person's monthly base salary.">
        <form onSubmit={submitIncrement} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Person *</label>
            <Select
              value={incPersonId}
              onChange={(e) => setIncPersonId(e.target.value)}
              placeholder="Select a person"
              searchable
              options={withSalary.map((p) => ({ label: fullName(p), value: p.id, description: inr(p.salaryAssignment!.baseGross) }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Increment amount (INR) *</label>
              <Input type="number" step="0.01" placeholder="e.g. 5000" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} required className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Effective date *</label>
              <Input type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} required className="h-9 text-xs" />
            </div>
          </div>
          {incPerson && incNewGross != null && (
            <p className="text-xs text-muted-foreground">
              New base salary: <span className="font-semibold text-foreground">{inr(incNewGross)}</span> (current {inr(incOldGross)})
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Remarks</label>
            <Input placeholder="e.g. Annual performance review" value={incRemarks} onChange={(e) => setIncRemarks(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIncOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={incMutation.isPending}>{incMutation.isPending ? "Saving…" : "Give increment"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
