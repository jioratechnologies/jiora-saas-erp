import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  AlertCircle,
  FileText,
  Upload,
  Paperclip,
  Check,
  Building,
  HeartHandshake,
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
import { PageHeader } from "../../components/page-header";

interface ExpenseClaim {
  id: string;
  title: string;
  category: "TRAVEL" | "LODGING" | "FOOD" | "SUPPLIES" | "COMMUNICATION" | "OFFICIAL_MEETING" | "OTHER";
  amount: number;
  expenseDate: string;
  description?: string;
  receiptUrls: any[];
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SETTLED";
  decisionNotes?: string;
  settlementReference?: string;
  createdAt: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
  };
  approver?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface SalaryAdvance {
  id: string;
  amountRequested: number;
  amountApproved?: number;
  reason: string;
  tenureMonths: number;
  monthlyDeduction: number;
  amountRecovered: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RECOVERING" | "RECOVERED";
  decisionNotes?: string;
  createdAt: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
  };
}

export function ClaimsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canReadClaims = Boolean(me?.permissionKeys?.includes("payroll.claim.read") || me?.permissionKeys?.includes("payroll.claim.manage"));
  const canReadAdvances = Boolean(me?.permissionKeys?.includes("payroll.advance.manage"));
  const canManageClaims = Boolean(me?.permissionKeys?.includes("payroll.claim.manage"));
  const canManageAdvances = Boolean(me?.permissionKeys?.includes("payroll.advance.manage"));

  const [activeSection, setActiveSection] = useState<"expenses" | "advances">("expenses");
  const [filterMode, setFilterMode] = useState<"my" | "team">(canReadClaims || canReadAdvances ? "team" : "my");

  // Claim Submit Modal
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimTitle, setClaimTitle] = useState("");
  const [claimCategory, setClaimCategory] = useState<any>("TRAVEL");
  const [claimAmount, setClaimAmount] = useState("");
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split("T")[0]);
  const [claimDesc, setClaimDesc] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advance Request Modal
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");
  const [advanceTenure, setAdvanceTenure] = useState("3");

  // Decision Modal
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<"claim" | "advance">("claim");
  const [decisionTargetId, setDecisionTargetId] = useState<string | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [decisionNotes, setDecisionNotes] = useState("");

  // Queries
  const { data: claims, isLoading: loadingClaims, isError: errClaims, error: claimsError, refetch: refetchClaims } = useQuery({
    queryKey: ["payroll", "claims", "expenses", filterMode],
    queryFn: () => {
      const endpoint = filterMode === "my" ? "/payroll/claims/expenses/my" : "/payroll/claims/expenses";
      return api.get<ExpenseClaim[]>(endpoint);
    },
  });

  const { data: advances, isLoading: loadingAdvances, isError: errAdvances, error: advancesError, refetch: refetchAdvances } = useQuery({
    queryKey: ["payroll", "claims", "advances", filterMode],
    queryFn: () => {
      const endpoint = filterMode === "my" ? "/payroll/claims/advances/my" : "/payroll/claims/advances";
      return api.get<SalaryAdvance[]>(endpoint);
    },
  });

  // Mutations
  const submitClaimMutation = useMutation({
    mutationFn: async (data: any) => {
      const claim = await api.post<ExpenseClaim>("/payroll/claims/expenses", data);
      if (receiptFile) {
        const formData = new FormData();
        formData.append("file", receiptFile);
        await api.post(`/payroll/claims/expenses/${claim.id}/receipt`, formData);
      }
      return claim;
    },
    onSuccess: () => {
      toast.success("Expense claim submitted.");
      queryClient.invalidateQueries({ queryKey: ["payroll", "claims", "expenses"] });
      setClaimModalOpen(false);
      setClaimTitle("");
      setClaimAmount("");
      setReceiptFile(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit claim."),
  });

  const submitAdvanceMutation = useMutation({
    mutationFn: (data: any) => api.post("/payroll/claims/advances", data),
    onSuccess: () => {
      toast.success("Salary advance request submitted.");
      queryClient.invalidateQueries({ queryKey: ["payroll", "claims", "advances"] });
      setAdvanceModalOpen(false);
      setAdvanceAmount("");
      setAdvanceReason("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to request advance."),
  });

  const decideMutation = useMutation({
    mutationFn: ({ type, id, status, decisionNotes }: any) => {
      const endpoint =
        type === "claim"
          ? `/payroll/claims/expenses/${id}/decide`
          : `/payroll/claims/advances/${id}/decide`;
      return api.patch(endpoint, { status, decisionNotes });
    },
    onSuccess: () => {
      toast.success("Decision recorded successfully.");
      queryClient.invalidateQueries({ queryKey: ["payroll", "claims"] });
      setDecisionModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit decision."),
  });

  const settleMutation = useMutation({
    mutationFn: (claimId: string) =>
      api.patch(`/payroll/claims/expenses/${claimId}/settle`, {
        settlementReference: `SETTLE-${Date.now().toString().slice(-6)}`,
      }),
    onSuccess: () => {
      toast.success("Claim marked as settled / reimbursed.");
      queryClient.invalidateQueries({ queryKey: ["payroll", "claims", "expenses"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to settle claim."),
  });

  const handleOpenDecision = (type: "claim" | "advance", id: string, defaultStatus: "APPROVED" | "REJECTED") => {
    setDecisionType(type);
    setDecisionTargetId(id);
    setDecisionStatus(defaultStatus);
    setDecisionNotes("");
    setDecisionModalOpen(true);
  };

  const handleExportClaimsCsv = () => {
    if (!claims || claims.length === 0) {
      toast.error("No claims to export.");
      return;
    }
    const rows = claims.map((c) => ({
      "Title": c.title,
      "Category": c.category,
      "Employee": `${c.person.firstName} ${c.person.lastName}`,
      "Amount (INR)": c.amount,
      "Expense Date": c.expenseDate?.substring(0, 10),
      "Status": c.status,
      "Approver": c.approver ? `${c.approver.firstName} ${c.approver.lastName}` : "Pending",
      "Decision Notes": c.decisionNotes || "N/A",
    }));
    exportToCsv("Expense_Claims_Register", rows);
    toast.success("Expense claims exported.");
  };

  const totalApprovedAmount = (claims || [])
    .filter((c) => c.status === "APPROVED" || c.status === "SETTLED")
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const pendingCount = (claims || []).filter((c) => c.status === "SUBMITTED").length;
  const activeAdvancesCount = (advances || []).filter((a) => a.status === "APPROVED" || a.status === "RECOVERING").length;

  return (
    <div className="space-y-6 w-full">
      {/* Sticky Header with Stats */}
      <PageHeader
        icon={CreditCard}
        title="Claims & Advances"
        description="Reimbursement claims with receipt uploads and emergency salary advance requests with EMI repayment."
        badge={
          <Badge variant="outline" className="text-xs font-mono">
            {activeSection === "expenses" ? `${claims?.length || 0} Claims` : `${advances?.length || 0} Advances`}
          </Badge>
        }
        action={
          <div className="flex items-center gap-2">
            {activeSection === "expenses" && (
              <Button variant="outline" size="sm" onClick={handleExportClaimsCsv} className="gap-2 text-xs rounded-xl">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
            {activeSection === "expenses" ? (
              <Button size="sm" onClick={() => setClaimModalOpen(true)} className="gap-2 text-xs rounded-xl shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                Submit Claim
              </Button>
            ) : (
              <Button size="sm" onClick={() => setAdvanceModalOpen(true)} className="gap-2 text-xs rounded-xl shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                Request Advance
              </Button>
            )}
          </div>
        }
        stats={
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-muted-foreground block font-medium">Total Claims</span>
              <span className="text-base font-bold text-foreground">{claims?.length || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-muted-foreground block font-medium">Approved & Settled</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">₹{totalApprovedAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-muted-foreground block font-medium">Pending Review</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">{pendingCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-muted-foreground block font-medium">Active Advances</span>
              <span className="text-base font-bold text-primary">{activeAdvancesCount}</span>
            </div>
          </div>
        }
      />

      {/* Tabs & Queue Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSection("expenses")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSection === "expenses"
                ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Expense Reimbursements ({claims?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveSection("advances")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSection === "advances"
                ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Emergency Salary Advances ({advances?.length ?? 0})
          </button>
        </div>

        {/* Filter scope: My vs Team */}
        {(canReadClaims || canReadAdvances) && (
          <div className="flex items-center bg-white/70 dark:bg-zinc-950/70 p-1 rounded-xl text-xs border border-zinc-200/60 dark:border-zinc-800/60">
            <button
              onClick={() => setFilterMode("my")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                filterMode === "my"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Requests
            </button>
            <button
              onClick={() => setFilterMode("team")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                filterMode === "team"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All / Review Queue
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: Expense Claims */}
      {activeSection === "expenses" && (
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <QueryState
              isLoading={loadingClaims}
              error={claimsError}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-muted-foreground">
                      <th className="py-3 px-4 text-left font-semibold">Claim Title</th>
                      <th className="py-3 px-4 text-left font-semibold">Category</th>
                      <th className="py-3 px-4 text-left font-semibold">Staff Member</th>
                      <th className="py-3 px-4 text-right font-semibold">Amount</th>
                      <th className="py-3 px-4 text-left font-semibold">Expense Date</th>
                      <th className="py-3 px-4 text-center font-semibold">Status</th>
                      <th className="py-3 px-4 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {(claims || []).map((c) => {
                      const statusVariant =
                        c.status === "SETTLED" ? "success" : c.status === "APPROVED" ? "default" : c.status === "REJECTED" ? "destructive" : "secondary";
                      return (
                        <tr key={c.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-semibold text-foreground">
                            <div>{c.title}</div>
                            {c.description && <div className="text-[11px] text-muted-foreground font-normal">{c.description}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline">{c.category}</Badge>
                          </td>
                          <td className="py-3 px-4 text-foreground">
                            {c.person.firstName} {c.person.lastName}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-foreground">
                            ₹{c.amount.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {c.expenseDate?.substring(0, 10)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={statusVariant}>{c.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {filterMode === "team" && canManageClaims && c.status === "SUBMITTED" && (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDecision("claim", c.id, "APPROVED")}
                                  className="h-7 text-[11px] px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDecision("claim", c.id, "REJECTED")}
                                  className="h-7 text-[11px] px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                            {filterMode === "team" && canManageClaims && c.status === "APPROVED" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => settleMutation.mutate(c.id)}
                                disabled={settleMutation.isPending}
                                className="h-7 text-[11px] px-2 text-indigo-600 dark:text-indigo-400"
                              >
                                Mark Settled
                              </Button>
                            )}
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
      )}

      {/* SECTION 2: Salary Advances */}
      {activeSection === "advances" && (
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <QueryState
              isLoading={loadingAdvances}
              error={advancesError}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-muted-foreground">
                      <th className="py-3 px-4 text-left font-semibold">Staff Member</th>
                      <th className="py-3 px-4 text-right font-semibold">Amount Requested</th>
                      <th className="py-3 px-4 text-center font-semibold">Tenure</th>
                      <th className="py-3 px-4 text-right font-semibold">Monthly EMI</th>
                      <th className="py-3 px-4 text-right font-semibold">Recovered</th>
                      <th className="py-3 px-4 text-center font-semibold">Status</th>
                      <th className="py-3 px-4 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {(advances || []).map((adv) => {
                      const statusVariant =
                        adv.status === "RECOVERED" ? "success" : adv.status === "APPROVED" || adv.status === "RECOVERING" ? "default" : adv.status === "REJECTED" ? "destructive" : "secondary";
                      return (
                        <tr key={adv.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">
                              {adv.person.firstName} {adv.person.lastName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{adv.reason}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-foreground">
                            ₹{adv.amountRequested.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-center text-foreground">{adv.tenureMonths} Months</td>
                          <td className="py-3 px-4 text-right text-rose-600 font-semibold">
                            ₹{adv.monthlyDeduction.toLocaleString("en-IN")} / mo
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                            ₹{adv.amountRecovered.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={statusVariant}>{adv.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {filterMode === "team" && canManageAdvances && adv.status === "PENDING" && (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDecision("advance", adv.id, "APPROVED")}
                                  className="h-7 text-[11px] px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDecision("advance", adv.id, "REJECTED")}
                                  className="h-7 text-[11px] px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
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
      )}

      {/* Modal: Submit Claim */}
      <Modal
        isOpen={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        title="Submit Reimbursement Claim"
        description="Attach bills and tickets for travel, lodging, or operational expenses."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amt = parseFloat(claimAmount);
            if (!amt || amt <= 0) {
              toast.error("Please enter a valid claim amount.");
              return;
            }
            submitClaimMutation.mutate({
              title: claimTitle,
              category: claimCategory,
              amount: amt,
              expenseDate: claimDate,
              description: claimDesc,
            });
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Claim Title *</label>
            <Input
              placeholder="e.g. Field visit train tickets to Lucknow"
              value={claimTitle}
              onChange={(e) => setClaimTitle(e.target.value)}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Category</label>
              <Select
                value={claimCategory}
                onChange={(e) => setClaimCategory(e.target.value as any)}
                options={[
                  { label: "Travel & Transport", value: "TRAVEL" },
                  { label: "Lodging & Hotel", value: "LODGING" },
                  { label: "Food & Meals", value: "FOOD" },
                  { label: "Office Supplies", value: "SUPPLIES" },
                  { label: "Official Meeting", value: "OFFICIAL_MEETING" },
                  { label: "Other Expense", value: "OTHER" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Amount (INR) *</label>
              <Input
                type="number"
                placeholder="1500"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Expense Date *</label>
            <Input
              type="date"
              value={claimDate}
              onChange={(e) => setClaimDate(e.target.value)}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description / Business Purpose</label>
            <Input
              placeholder="Details regarding travel or client meeting purpose"
              value={claimDesc}
              onChange={(e) => setClaimDesc(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Attach Receipt (PDF / JPEG / PNG)</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              accept=".pdf,.jpg,.jpeg,.png"
              className="text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:bg-zinc-100 dark:file:bg-zinc-800 file:text-foreground hover:file:bg-zinc-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setClaimModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitClaimMutation.isPending}>
              {submitClaimMutation.isPending ? "Submitting…" : "Submit Claim"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Request Advance */}
      <Modal
        isOpen={advanceModalOpen}
        onClose={() => setAdvanceModalOpen(false)}
        title="Request Emergency Salary Advance"
        description="Apply for an advance against upcoming salary with scheduled monthly repayments."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amt = parseFloat(advanceAmount);
            if (!amt || amt <= 0) {
              toast.error("Please enter a valid advance amount.");
              return;
            }
            submitAdvanceMutation.mutate({
              amountRequested: amt,
              reason: advanceReason,
              tenureMonths: parseInt(advanceTenure, 10),
            });
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Amount Requested (INR) *</label>
            <Input
              type="number"
              placeholder="e.g. 15000"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Repayment Tenure (Months)</label>
            <Select
              value={advanceTenure}
              onChange={(e) => setAdvanceTenure(e.target.value)}
              options={[
                { label: "1 Month (Full deduction next cycle)", value: "1" },
                { label: "2 Months", value: "2" },
                { label: "3 Months", value: "3" },
                { label: "6 Months", value: "6" },
              ]}
            />
            {advanceAmount && (
              <p className="text-[11px] text-muted-foreground">
                Estimated deduction: ₹
                {Math.round(parseFloat(advanceAmount) / parseInt(advanceTenure, 10)).toLocaleString("en-IN")}{" "}
                per payroll cycle.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Reason for Advance *</label>
            <Input
              placeholder="e.g. Medical emergency or urgent personal expense"
              value={advanceReason}
              onChange={(e) => setAdvanceReason(e.target.value)}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdvanceModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitAdvanceMutation.isPending}>
              {submitAdvanceMutation.isPending ? "Submitting…" : "Request Advance"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Decision */}
      <Modal
        isOpen={decisionModalOpen}
        onClose={() => setDecisionModalOpen(false)}
        title={`${decisionStatus === "APPROVED" ? "Approve" : "Reject"} ${decisionType === "claim" ? "Claim" : "Advance"}`}
        description="Provide optional feedback notes regarding this decision."
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Decision Notes / Remarks</label>
            <Input
              placeholder="e.g. Approved per organization travel policy"
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="outline" size="sm" onClick={() => setDecisionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={decisionStatus === "APPROVED" ? "default" : "destructive"}
              disabled={decideMutation.isPending}
              onClick={() => {
                if (decisionTargetId) {
                  decideMutation.mutate({
                    type: decisionType,
                    id: decisionTargetId,
                    status: decisionStatus,
                    decisionNotes,
                  });
                }
              }}
            >
              Confirm {decisionStatus}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
