import { fullName } from "../../lib/input-constraints";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck, Check, X, Paperclip } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { User } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal } from "../../components/ui/modal";
import { toast } from "../../components/ui/toast";
import { formatErrorMessage } from "../../lib/error-formatter";
import { Pagination, usePagination } from "../../components/ui/pagination";
import type { LeaveRequest } from "./LeavePage";

export function LeaveApprovalsPage() {
  const queryClient = useQueryClient();

  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<{ id: string; action: "approve" | "reject"; personName: string } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  const {
    data: approvals,
    isLoading: approvalsLoading,
    error: approvalsError,
  } = useQuery({
    queryKey: ["hr", "leave", "requests", "approvals"],
    queryFn: () => api.get<LeaveRequest[]>("/hr/leave/requests?scope=approvals"),
  });

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
      toast.error("Failed to process decision", formatErrorMessage(err));
    },
  });

  const approvalsPagination = usePagination(approvals ?? [], 10);
  const pendingCount = (approvals ?? []).filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6">
      <PageHeader
        icon={FileCheck}
        title="Leave Approvals"
        description="Review and decide leave requests from your team."
        badge={
          <Badge variant="outline" className="text-xs font-mono">
            {pendingCount} Pending
          </Badge>
        }
      />

        <Card>
          <CardContent className="p-0">
            <QueryState isLoading={approvalsLoading} error={approvalsError}>
              {approvalsPagination.paginatedItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No team leave requests pending your review.
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                    {approvalsPagination.paginatedItems.map((req) => (
                      <div key={req.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <User
                            name={`${fullName(req.person)}`}
                            description={req.person.department?.name || req.person.email}
                            avatarProps={{ size: "sm", isBordered: true }}
                          />
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

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100/60 dark:border-zinc-800/60">
                          <Badge variant="outline" size="sm">
                            {req.leaveType.code}
                          </Badge>
                          <span className="text-muted-foreground font-medium">
                            {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()} ({req.daysCount}d)
                          </span>
                        </div>

                        {req.reason && (
                          <div className="text-xs text-muted-foreground bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
                            <span className="font-semibold text-foreground">Reason: </span>
                            {req.reason}
                          </div>
                        )}

                        {req.supportingDocuments && req.supportingDocuments.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {req.supportingDocuments.map((doc, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleDownloadDoc(doc.fileKey)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer font-medium"
                                title={`Download ${doc.name}`}
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[140px]">{doc.name}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {req.status === "PENDING" ? (
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDecisionTarget({
                                  id: req.id,
                                  action: "approve",
                                  personName: `${fullName(req.person)}`,
                                });
                                setDecisionModalOpen(true);
                              }}
                              className="h-8 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 justify-center"
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
                                  personName: `${fullName(req.person)}`,
                                });
                                setDecisionModalOpen(true);
                              }}
                              className="h-8 text-xs border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 justify-center"
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="text-right text-xs text-muted-foreground italic">Processed</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
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
                        {approvalsPagination.paginatedItems.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell>
                              <User
                                name={`${fullName(req.person)}`}
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
                                        personName: `${fullName(req.person)}`,
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
                                        personName: `${fullName(req.person)}`,
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </QueryState>
            <Pagination
              currentPage={approvalsPagination.currentPage}
              totalPages={approvalsPagination.totalPages}
              totalItems={approvalsPagination.totalItems}
              pageSize={approvalsPagination.pageSize}
              onPageChange={approvalsPagination.setCurrentPage}
              onPageSizeChange={(size) => { approvalsPagination.setPageSize(size); approvalsPagination.setCurrentPage(1); }}
            />
          </CardContent>
        </Card>

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
    </div>
  );
}
