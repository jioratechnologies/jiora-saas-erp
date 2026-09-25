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
} from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { User } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal } from "../../components/ui/modal";
import { toast } from "../../components/ui/toast";
import { useMe } from "../../auth/use-me";

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
  const submitRequest = useMutation({
    mutationFn: () =>
      api.post<LeaveRequest>("/hr/leave/requests", {
        leaveTypeId: selectedTypeId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason,
      }),
    onSuccess: () => {
      setApplyModalOpen(false);
      setSelectedTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["hr", "leave", "requests"] });
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
      queryClient.invalidateQueries({ queryKey: ["hr", "leave", "types"] });
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
      queryClient.invalidateQueries({ queryKey: ["hr", "leave", "requests"] });
      toast.success(
        vars.action === "approve" ? "Leave approved" : "Leave rejected",
        "The request status has been updated.",
      );
    },
    onError: (err) => {
      toast.error("Failed to process decision", (err as Error).message);
    },
  });

  const canApprove = me?.permissionKeys?.includes("hr.leave.approve");
  const canManageTypes = me?.permissionKeys?.includes("hr.holiday.write");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Leave Management"
          description="Apply for leave, track quota balances, and review team approval requests."
        />
        <div className="flex items-center gap-2">
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

      {/* Quota Balance Cards (Valkey Cached) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {leaveTypes?.map((type) => (
          <Card key={type.id} className="p-4 border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <Badge variant="default" size="sm">
                {type.code}
              </Badge>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold tracking-tight text-foreground">{type.annualQuota}</div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{type.name}</p>
            </div>
          </Card>
        ))}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRequests?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
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
                        <TableCell className="text-xs max-w-xs truncate text-muted-foreground">
                          {req.reason}
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
                        <TableCell className="text-xs max-w-xs truncate text-muted-foreground">
                          {req.reason}
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
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Leave Policy *</label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Select leave category</option>
              {leaveTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code}) — {t.annualQuota} days/yr
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Start Date *</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">End Date *</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
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
