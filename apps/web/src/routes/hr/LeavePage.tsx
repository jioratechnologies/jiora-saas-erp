import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  PlaneTakeoff,
  X,
  Paperclip,
  Upload,
  FileText,
  Download,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../api/client";
import { useMe } from "../../auth/use-me";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Select } from "../../components/ui/select";
import { DatePicker } from "../../components/ui/date-picker";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal } from "../../components/ui/modal";
import { toast } from "../../components/ui/toast";
import { formatErrorMessage } from "../../lib/error-formatter";
import { useAuthStore } from "../../auth/auth-store";
import { cn } from "../../lib/utils";
import { exportToExcel } from "../../lib/excel-export";
import { Pagination, usePagination } from "../../components/ui/pagination";

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

export interface LeaveRequest {
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
    firstName: string; middleName?: string | null;
    lastName: string;
    email: string;
    personType: string;
    department?: { name: string } | null;
  };
}

export function LeavePage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const isPlatformAdmin = Boolean(me?.isPlatformContext);

  const [applyModalOpen, setApplyModalOpen] = useState(false);

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
    } catch (err) {
      toast.error("Upload failed", formatErrorMessage(err));
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
    } catch (err) {
      toast.error("Download failed", formatErrorMessage(err));
    }
  };

  // Queries
  const { data: leaveTypes, isLoading: typesLoading } = useQuery({
    queryKey: ["hr", "leave", "types"],
    queryFn: () => api.get<LeaveType[]>("/hr/leave/types"),
  });

  const { data: leaveBalances } = useQuery({
    queryKey: ["hr", "leave", "balances"],
    queryFn: () => api.get<LeaveBalance[]>("/hr/leave/balances"),
    enabled: !isPlatformAdmin,
  });

  const {
    data: myRequests,
    isLoading: myRequestsLoading,
    error: myRequestsError,
  } = useQuery({
    queryKey: ["hr", "leave", "requests", "own"],
    queryFn: () => api.get<LeaveRequest[]>("/hr/leave/requests?scope=own"),
    enabled: !isPlatformAdmin,
  });

  // Mutations
  const cancelRequest = useMutation({
    mutationFn: (requestId: string) => api.post(`/hr/leave/requests/${requestId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "leave"] });
      toast.success("Leave request cancelled", "Your application has been withdrawn.");
    },
    onError: (err) => {
      toast.error("Failed to cancel leave", formatErrorMessage(err));
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
      toast.error("Failed to submit leave", formatErrorMessage(err));
    },
  });

  const handleExportCsv = () => {
    if (myRequests) {
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
      exportToExcel("My_Leave_Requests", headers, rows);
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
      exportToExcel("Leave_Balance_Ledger", headers, rows);
      toast.success("Leave ledger exported", `${rows.length} policy balances downloaded.`);
    }
  };


  // Pagination
  const myRequestsPagination = usePagination(myRequests ?? [], 10);

  if (isPlatformAdmin) {
    return (
      <div className="space-y-6 w-full max-w-4xl mx-auto py-10">
        <Card className="text-center p-8 sm:p-12 border-dashed bg-zinc-50/50 dark:bg-zinc-900/40">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <PlaneTakeoff className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">Platform Administrator Account</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
            You are logged in with Platform Administrator privileges. Self-service leave quotas and requests are managed on an individual employee basis. To review pending staff requests or configure organisation leave policies, select an administrative tool below.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/hr/leave/approvals">
              <Button className="gap-2">
                <UserCheck className="h-4 w-4" />
                <span>Leave Approvals Queue</span>
              </Button>
            </Link>
            <Link to="/hr/leave/policies">
              <Button variant="outline" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>Leave Policies & Holidays</span>
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6">
      <PageHeader
        icon={PlaneTakeoff}
        title="Leave Management"
        description="Apply for leave, track quota balances, and follow your requests."
        badge={
          <Badge variant="outline" className="text-xs font-mono">
            {myRequests?.length || 0} Requests
          </Badge>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5 rounded-xl text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </Button>
            <Button onClick={() => setApplyModalOpen(true)} className="gap-2 shrink-0 rounded-xl text-xs font-bold shadow-sm">
              <PlaneTakeoff className="h-3.5 w-3.5" />
              <span>Apply for Leave</span>
            </Button>
          </div>
        }
      />

      {/* Quota Balance Cards (Dynamic Real-Time Ledger) */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
        {(leaveBalances || leaveTypes)?.map((item: any) => {
          const remaining = item.remainingBalance ?? item.annualQuota;
          const quota = item.annualQuota;
          const approved = item.approvedDays ?? 0;
          const pending = item.pendingDays ?? 0;

          return (
            <Card key={item.id} className="p-2.5 sm:p-4 border-zinc-200/80 dark:border-zinc-800 bg-linear-to-b from-white to-zinc-50/50 dark:from-zinc-900 dark:to-zinc-900/50">
              <div className="flex items-center justify-between">
                <Badge variant="default" size="sm" className="text-[10px] sm:text-xs px-1.5 py-0 sm:px-2 sm:py-0.5">
                  {item.code}
                </Badge>
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              </div>
              <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                <div className="flex items-baseline gap-1 sm:gap-1.5">
                  <span className="text-lg sm:text-2xl font-bold tracking-tight text-foreground font-mono">{remaining}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">/ {quota}d left</span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{item.name}</p>
                <div className="flex items-center gap-1.5 pt-0.5 text-[10px] sm:text-[11px] text-muted-foreground flex-wrap">
                  <span>Used: <strong className="text-foreground">{approved}d</strong></span>
                  {pending > 0 && <span className="text-amber-600 dark:text-amber-400">· Pend: <strong>{pending}d</strong></span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* My Requests */}
        <Card>
          <CardContent className="p-0">
            <QueryState isLoading={myRequestsLoading} error={myRequestsError}>
              {myRequestsPagination.paginatedItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  You have not submitted any leave requests yet.
                </div>
              ) : (
                <>
                  {/* Mobile Card List (sm:hidden) */}
                  <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                    {myRequestsPagination.paginatedItems.map((req) => (
                      <div key={req.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" size="sm" className="font-semibold text-xs">
                            {req.leaveType.code} - {req.leaveType.name}
                          </Badge>
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
                        </div>

                        <div className="flex items-center justify-between text-xs text-foreground">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>
                              {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">
                            {req.daysCount} day{req.daysCount > 1 ? "s" : ""}
                          </span>
                        </div>

                        {req.reason && (
                          <p className="text-xs text-muted-foreground line-clamp-2 italic">
                            "{req.reason}"
                          </p>
                        )}

                        {req.supportingDocuments && req.supportingDocuments.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {req.supportingDocuments.map((doc, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleDownloadDoc(doc.fileKey)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-foreground transition-colors cursor-pointer"
                                title={`Download ${doc.name}`}
                              >
                                <Paperclip className="h-3 w-3 text-primary shrink-0" />
                                <span className="truncate max-w-[140px] font-medium">{doc.name}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {req.decisionNotes && (
                          <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-[11px] text-muted-foreground">
                            <strong>Approver Remarks:</strong> {req.decisionNotes}
                          </div>
                        )}

                        {req.status === "PENDING" && (
                          <div className="flex justify-end pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelRequest.mutate(req.id)}
                              disabled={cancelRequest.isPending}
                              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium"
                            >
                              Cancel Request
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (hidden sm:block) */}
                  <div className="hidden sm:block overflow-x-auto">
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
                        {myRequestsPagination.paginatedItems.map((req) => (
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </QueryState>
            <Pagination
              currentPage={myRequestsPagination.currentPage}
              totalPages={myRequestsPagination.totalPages}
              totalItems={myRequestsPagination.totalItems}
              pageSize={myRequestsPagination.pageSize}
              onPageChange={myRequestsPagination.setCurrentPage}
              onPageSizeChange={(size) => { myRequestsPagination.setPageSize(size); myRequestsPagination.setCurrentPage(1); }}
            />
          </CardContent>
        </Card>

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
    </div>
  );
}
