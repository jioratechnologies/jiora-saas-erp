import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  PlaneTakeoff,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  X,
  FileCheck,
  AlertCircle,
  Paperclip,
  Upload,
  FileText,
  Download,
} from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { DatePicker } from "../../components/ui/date-picker";
import { DateInput } from "../../components/ui/date-input";
import { Badge } from "../../components/ui/badge";
import { User } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal } from "../../components/ui/modal";
import { toast } from "../../components/ui/toast";
import { useMe } from "../../auth/use-me";
import { useAuthStore } from "../../auth/auth-store";
import { cn } from "../../lib/utils";
import { exportToCsv } from "../../lib/csv-export";

export interface LeaveSupportingDoc {
  name: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
}

export interface LeaveBalance {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  approvedDays: number;
  pendingDays: number;
  remainingBalance: number;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  applicableTo: "ALL" | "EMPLOYEES_ONLY" | "VOLUNTEERS_ONLY";
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  supportingDocuments?: LeaveSupportingDoc[];
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decisionNotes?: string | null;
  decidedAt?: string | null;
  leaveType: {
    name: string;
    code: string;
  };
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    personType: string;
    department?: { name: string } | null;
  };
}

export function LeavePage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const [activeTab, setActiveTab] = useState<"my-requests" | "approvals">("my-requests");
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [createTypeModalOpen, setCreateTypeModalOpen] = useState(false);

  // Apply Form State
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<LeaveSupportingDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const token = useAuthStore((s) => s.user?.access_token);

  // File upload for leave supporting docs
  const handleSupportingDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingDoc(true);
    try {
      const newDocs: LeaveSupportingDoc[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        const data = await api.upload<LeaveSupportingDoc>("/hr/leave/requests/upload-document", formData);
        newDocs.push(data);
      }
      setUploadedDocs((prev) => [...prev, ...newDocs]);
      toast.success("Files attached", `${newDocs.length} supporting document(s) uploaded.`);
    } catch (err: any) {
      toast.error("Upload failed", err.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  };

  const handleDownloadDoc = async (fileKey: string) => {
    try {
      const data = await api.get<{ url: string }>(`/hr/leave/requests/document-url?key=${encodeURIComponent(fileKey)}`);
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Download failed", err.message || "Could not retrieve document URL.");
    }
  };

  // Create Leave Type Form State
  const [typeName, setTypeName] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [annualQuota, setAnnualQuota] = useState(12);

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<{ id: string; action: "approve" | "reject"; personName: string } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  // Queries
  const { data: leaveTypes, isLoading: typesLoading } = useQuery({
    queryKey: ["hr", "leave", "types"],
    queryFn: () => api.get<LeaveType[]>("/hr/leave/types"),
  });

  const { data: leaveBalances } = useQuery({
    queryKey: ["hr", "leave", "balances"],
    queryFn: () => api.get<LeaveBalance[]>("/hr/leave/balances"),
  });

  const {
    data: myRequests,
    isLoading: myRequestsLoading,
    error: myRequestsError,
  } = useQuery({
    queryKey: ["hr", "leave", "requests", "own"],
    queryFn: () => api.get<LeaveRequest[]>("/hr/leave/requests?scope=own"),
    enabled: activeTab === "my-requests",
  });

  const {
    data: approvals,
    isLoading: approvalsLoading,
    error: approvalsError,
  } = useQuery({
    queryKey: ["hr", "leave", "requests", "approvals"],
    queryFn: () => api.get<LeaveRequest[]>("/hr/leave/requests?scope=approvals"),
    enabled: activeTab === "approvals",
  });

  // Mutations
  const cancelRequest = useMutation({
    mutationFn: (requestId: string) => api.post(`/hr/leave/requests/${requestId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "leave"] });
      toast.success("Leave request cancelled", "Your application has been withdrawn.");
    },
    onError: (err) => {
      toast.error("Failed to cancel leave", (err as Error).message);
    },
  });

  const submitRequest = useMutation({
    mutationFn: () =>
      api.post<LeaveRequest>("/hr/leave/requests", {
        leaveTypeId: selectedTypeId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason,
        supportingDocuments: uploadedDocs,
      }),
    onSuccess: () => {
      setApplyModalOpen(false);
      setSelectedTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setUploadedDocs([]);
      queryClient.invalidateQueries({ queryKey: ["hr", "leave"] });
      toast.success("Leave request submitted", "Your manager has been notified for approval.");
    },
    onError: (err) => {
      toast.error("Failed to submit leave", (err as Error).message);
    },
  });

  const createType = useMutation({
    mutationFn: () =>
      api.post<LeaveType>("/hr/leave/types", {
        name: typeName,
        code: typeCode.toUpperCase(),
        annualQuota: Number(annualQuota),
      }),
    onSuccess: (t) => {
      setCreateTypeModalOpen(false);
      setTypeName("");
      setTypeCode("");
      setAnnualQuota(12);
      queryClient.invalidateQueries({ queryKey: ["hr", "leave"] });
      toast.success("Leave policy created", `Policy "${t.name}" added with ${t.annualQuota} days annual quota.`);
    },
    onError: (err) => {
      toast.error("Failed to create leave policy", (err as Error).message);
    },
  });

  const decideRequest = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: "approve" | "reject"; notes?: string }) =>
      api.patch(`/hr/leave/requests/${id}/${action}`, { decisionNotes: notes || undefined }),
    onSuccess: (_, vars) => {
      setDecisionModalOpen(false);
      setDecisionTarget(null);
      setDecisionNotes("");
      queryClient.invalidateQueries({ queryKey: ["hr", "leave"] });
      toast.success(
        vars.action === "approve" ? "Leave approved" : "Leave rejected",
        "The request status has been updated.",
      );
    },
    onError: (err) => {
      toast.error("Failed to process decision", (err as Error).message);
    },
  });

  const handleExportCsv = () => {
    if (activeTab === "my-requests" && myRequests) {
      const headers = ["Leave Type", "Start Date", "End Date", "Days", "Reason", "Status", "Decision Notes"];
      const rows = myRequests.map((r) => [
        r.leaveType.name,
        new Date(r.startDate).toLocaleDateString(),
        new Date(r.endDate).toLocaleDateString(),
        r.daysCount,
        r.reason,
        r.status,
        r.decisionNotes || "",
      ]);
      exportToCsv("My_Leave_Requests", headers, rows);
      toast.success("Leave requests exported", `${rows.length} records downloaded.`);
    } else if (leaveBalances) {
      const headers = ["Leave Type", "Code", "Annual Quota", "Approved Used", "Pending Approval", "Remaining Balance"];
      const rows = leaveBalances.map((b) => [
        b.name,
        b.code,
        b.annualQuota,
        b.approvedDays,
        b.pendingDays,
        b.remainingBalance,
      ]);
      exportToCsv("Leave_Balance_Ledger", headers, rows);
      toast.success("Leave ledger exported", `${rows.length} policy balances downloaded.`);
    }
  };

  const canApprove = me?.permissionKeys?.includes("hr.leave.approve");
  const canManageTypes = me?.permissionKeys?.includes("hr.holiday.write");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Leave Management"
          description="Apply for leave, track quota balances, and review team approval requests."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Export (CSV)</span>
          </Button>
          {canManageTypes && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateTypeModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Leave Policy</span>
            </Button>
          )}
          <Button onClick={() => setApplyModalOpen(true)} className="gap-2 shrink-0">
            <PlaneTakeoff className="h-4 w-4" />
            <span>Apply for Leave</span>
          </Button>
        </div>
      </div>

      {/* Quota Balance Cards (Dynamic Real-Time Ledger) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(leaveBalances || leaveTypes)?.map((item: any) => {
          const remaining = item.remainingBalance ?? item.annualQuota;
          const quota = item.annualQuota;
          const approved = item.approvedDays ?? 0;
          const pending = item.pendingDays ?? 0;

          return (
            <Card key={item.id} className="p-4 border-zinc-200/80 dark:border-zinc-800 bg-linear-to-b from-white to-zinc-50/50 dark:from-zinc-900 dark:to-zinc-900/50">
              <div className="flex items-center justify-between">
                <Badge variant="default" size="sm">
                  {item.code}
                </Badge>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-foreground font-mono">{remaining}</span>
                  <span className="text-xs text-muted-foreground font-medium">/ {quota} days left</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  <span>Used: <strong className="text-foreground">{approved}d</strong></span>
                  {pending > 0 && <span className="text-amber-600 dark:text-amber-400">· Pending: <strong>{pending}d</strong></span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("my-requests")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === "my-requests"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          <span>My Requests</span>
        </button>
        {canApprove && (
          <button
            onClick={() => setActiveTab("approvals")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === "approvals"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <FileCheck className="h-4 w-4" />
            <span>Manager Approval Queue</span>
            {approvals && approvals.filter((r) => r.status === "PENDING").length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {approvals.filter((r) => r.status === "PENDING").length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab Content: My Requests */}
      {activeTab === "my-requests" && (
        <Card>
          <CardContent className="p-0">
            <QueryState isLoading={myRequestsLoading} error={myRequestsError}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approver Remarks</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRequests?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                        You have not submitted any leave requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    myRequests?.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-semibold text-foreground">
                          <Badge variant="outline" size="sm">
                            {req.leaveType.code} - {req.leaveType.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-bold text-xs">
                          {req.daysCount} day{req.daysCount > 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="text-xs max-w-xs text-muted-foreground">
                          <p className="truncate">{req.reason}</p>
                          {req.supportingDocuments && req.supportingDocuments.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {req.supportingDocuments.map((doc, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleDownloadDoc(doc.fileKey)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-foreground transition-colors cursor-pointer"
                                  title={`Download ${doc.name}`}
                                >
                                  <Paperclip className="h-3 w-3 text-primary shrink-0" />
                                  <span className="truncate max-w-[120px] font-medium">{doc.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              req.status === "APPROVED"
                                ? "success"
                                : req.status === "REJECTED"
                                ? "destructive"
                                : "warning"
                            }
                            dot
                            size="sm"
                          >
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground italic">
                          {req.decisionNotes || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelRequest.mutate(req.id)}
                              disabled={cancelRequest.isPending}
                              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium"
                            >
                              Cancel
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </QueryState>
          </CardContent>
        </Card>
      )}

      {/* Tab Content: Manager Approval Queue */}
      {activeTab === "approvals" && (
        <Card>
          <CardContent className="p-0">
            <QueryState isLoading={approvalsLoading} error={approvalsError}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subordinate</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-36 text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                        No team leave requests pending your review.
                      </TableCell>
                    </TableRow>
                  ) : (
                    approvals?.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <User
                            name={`${req.person.firstName} ${req.person.lastName}`}
                            description={req.person.department?.name || req.person.email}
                            avatarProps={{ size: "sm", isBordered: true }}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" size="sm">
                            {req.leaveType.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()} ({req.daysCount}d)
                        </TableCell>
                        <TableCell className="text-xs max-w-xs text-muted-foreground">
                          <p className="truncate">{req.reason}</p>
                          {req.supportingDocuments && req.supportingDocuments.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {req.supportingDocuments.map((doc, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleDownloadDoc(doc.fileKey)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer font-medium"
                                  title={`Download ${doc.name}`}
                                >
                                  <Paperclip className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[120px]">{doc.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              req.status === "APPROVED"
                                ? "success"
                                : req.status === "REJECTED"
                                ? "destructive"
                                : "warning"
                            }
                            dot
                            size="sm"
                          >
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDecisionTarget({
                                    id: req.id,
                                    action: "approve",
                                    personName: `${req.person.firstName} ${req.person.lastName}`,
                                  });
                                  setDecisionModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDecisionTarget({
                                    id: req.id,
                                    action: "reject",
                                    personName: `${req.person.firstName} ${req.person.lastName}`,
                                  });
                                  setDecisionModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Processed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </QueryState>
          </CardContent>
        </Card>
      )}

      {/* Apply Leave Modal */}
      <Modal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        title="Apply for Leave"
        description="Submit your leave application for manager approval."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitRequest.mutate();
          }}
          className="space-y-3.5"
        >
          <Select
            label="Leave Policy *"
            value={selectedTypeId}
            onChange={(e) => setSelectedTypeId(e.target.value)}
            required
          >
            <option value="">Select leave category</option>
            {leaveTypes?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code}) — {t.annualQuota} days/yr
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(val) => setStartDate(val)}
              isRequired
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(val) => setEndDate(val)}
              isRequired
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Reason for Leave *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide the purpose or context for your time off…"
              rows={3}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Supporting Documents (One or Multiple) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground block">
                Supporting Documents (Optional)
              </label>
              <span className="text-[11px] text-muted-foreground">PDF, PNG, JPG (1 or multiple)</span>
            </div>

            <label className={cn(
              "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-3.5 cursor-pointer transition-colors",
              uploadingDoc ? "opacity-60 pointer-events-none" : "hover:border-primary/50 hover:bg-primary/5 border-zinc-200 dark:border-zinc-800"
            )}>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                onChange={handleSupportingDocUpload}
                className="hidden"
                disabled={uploadingDoc}
              />
              <Upload className="h-5 w-5 text-muted-foreground mb-1 animate-pulse" />
              <p className="text-xs font-medium text-foreground text-center">
                {uploadingDoc ? "Uploading documents…" : "Click or drag & drop one or multiple supporting documents"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 text-center">
                Medical certificate, travel tickets, wedding invite, official letters
              </p>
            </label>

            {uploadedDocs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {uploadedDocs.map((doc, idx) => (
                  <div
                    key={doc.fileKey || idx}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate font-medium text-foreground">{doc.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({(doc.sizeBytes / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedDocs((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-red-500 p-1 cursor-pointer"
                      title="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedTypeId || !startDate || !endDate || !reason.trim() || submitRequest.isPending}
            >
              {submitRequest.isPending ? "Submitting…" : "Submit Leave Application"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Decision Remarks Modal */}
      <Modal
        isOpen={decisionModalOpen}
        onClose={() => setDecisionModalOpen(false)}
        title={decisionTarget?.action === "approve" ? "Approve Leave Request" : "Reject Leave Request"}
        description={`Decision for ${decisionTarget?.personName}`}
        maxWidth="sm"
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Decision Comments / Remarks (optional)
            </label>
            <Input
              placeholder={decisionTarget?.action === "approve" ? "Approved as planned." : "Please reschedule due to pending project deadline."}
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setDecisionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={decisionTarget?.action === "approve" ? "default" : "destructive"}
              onClick={() => {
                if (decisionTarget) {
                  decideRequest.mutate({
                    id: decisionTarget.id,
                    action: decisionTarget.action,
                    notes: decisionNotes,
                  });
                }
              }}
              disabled={decideRequest.isPending}
            >
              {decideRequest.isPending ? "Processing…" : decisionTarget?.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Leave Type Modal */}
      <Modal
        isOpen={createTypeModalOpen}
        onClose={() => setCreateTypeModalOpen(false)}
        title="Create Leave Policy"
        description="Define a new leave quota for staff or volunteers."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createType.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Leave Policy Name *</label>
            <Input
              placeholder="e.g. Casual Leave / Study Leave"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Code *</label>
              <Input
                placeholder="CL / SL"
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Annual Quota (Days) *</label>
              <Input
                type="number"
                min="1"
                max="365"
                value={annualQuota}
                onChange={(e) => setAnnualQuota(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setCreateTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!typeName.trim() || !typeCode.trim() || createType.isPending}
            >
              {createType.isPending ? "Saving…" : "Save Policy"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
