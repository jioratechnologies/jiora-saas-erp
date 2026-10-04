import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCog, Pencil, Plus } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal } from "../../components/ui/modal";
import { toast } from "../../components/ui/toast";
import { useMe } from "../../auth/use-me";
import { formatErrorMessage } from "../../lib/error-formatter";
import { cn } from "../../lib/utils";
import { HolidaysPage } from "./HolidaysPage";

type Applicability = "ALL" | "EMPLOYEE_ONLY";

interface LeaveTypeRow {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  applicableTo: Applicability;
  isActive: boolean;
}

const APPLIES_TO_OPTIONS = [
  { value: "ALL", label: "Everyone (employees & volunteers)" },
  { value: "EMPLOYEE_ONLY", label: "Employees only" },
];

const STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const appliesLabel = (a: Applicability) => (a === "EMPLOYEE_ONLY" ? "Employees only" : "Everyone");

export function LeavePoliciesPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  // Same permission as POST/PATCH /hr/leave/types on the API.
  const canManage = me?.permissionKeys?.includes("hr.person.write");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [quota, setQuota] = useState(12);
  const [applicableTo, setApplicableTo] = useState<Applicability>("ALL");
  const [isActive, setIsActive] = useState(true);

  const {
    data: types,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["hr", "leave", "types", "manage", Boolean(canManage)],
    queryFn: () => api.get<LeaveTypeRow[]>(`/hr/leave/types${canManage ? "?includeInactive=true" : ""}`),
    enabled: me !== undefined,
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setQuota(12);
    setApplicableTo("ALL");
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (t: LeaveTypeRow) => {
    setEditing(t);
    setName(t.name);
    setCode(t.code);
    setQuota(t.annualQuota);
    setApplicableTo(t.applicableTo);
    setIsActive(t.isActive);
    setModalOpen(true);
  };

  const saveType = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), code: code.trim().toUpperCase(), annualQuota: Number(quota), applicableTo };
      return editing
        ? api.patch<LeaveTypeRow>(`/hr/leave/types/${editing.id}`, { ...body, isActive })
        : api.post<LeaveTypeRow>("/hr/leave/types", body);
    },
    onSuccess: (t) => {
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["hr", "leave"] });
      toast.success(editing ? "Leave type updated" : "Leave type added", `"${t.name}" has been saved.`);
    },
    onError: (err) => {
      toast.error("Could not save leave type", formatErrorMessage(err));
    },
  });

  const toggleActive = useMutation({
    mutationFn: (t: LeaveTypeRow) => api.patch<LeaveTypeRow>(`/hr/leave/types/${t.id}`, { isActive: !t.isActive }),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "leave"] });
      toast.success(t.isActive ? "Leave type activated" : "Leave type deactivated", `"${t.name}" updated.`);
    },
    onError: (err) => {
      toast.error("Could not update leave type", formatErrorMessage(err));
    },
  });

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeader
        icon={CalendarCog}
        title="Leave Policies & Holidays"
        description="Set up leave types, yearly quotas and the holiday calendar."
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Leave Types</h2>
            <p className="text-xs text-muted-foreground">Inactive types are hidden from the apply form.</p>
          </div>
          {canManage && (
            <Button onClick={openCreate} className="gap-2 shrink-0 rounded-xl text-xs font-bold shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Leave Type</span>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <QueryState isLoading={isLoading} error={error}>
              {(types ?? []).length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No leave types set up yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Annual Quota</TableHead>
                        <TableHead>Applies To</TableHead>
                        <TableHead>Active</TableHead>
                        {canManage && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(types ?? []).map((t) => (
                        <TableRow key={t.id} className={cn(!t.isActive && "opacity-60")}>
                          <TableCell className="font-semibold text-foreground">{t.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" size="sm">
                              {t.code}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{t.annualQuota} days</TableCell>
                          <TableCell className="text-xs">{appliesLabel(t.applicableTo)}</TableCell>
                          <TableCell>
                            {canManage ? (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={t.isActive}
                                aria-label={`${t.isActive ? "Deactivate" : "Activate"} ${t.name}`}
                                disabled={toggleActive.isPending}
                                onClick={() => toggleActive.mutate(t)}
                                className={cn(
                                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50",
                                  t.isActive ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-700",
                                )}
                              >
                                <span
                                  className={cn(
                                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                                    t.isActive ? "translate-x-4.5" : "translate-x-0.5",
                                  )}
                                />
                              </button>
                            ) : (
                              <Badge variant={t.isActive ? "success" : "outline"} dot size="sm">
                                {t.isActive ? "Active" : "Inactive"}
                              </Badge>
                            )}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(t)}
                                className="h-7 gap-1 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </QueryState>
          </CardContent>
        </Card>
      </section>

      <section>
        <HolidaysPage embedded />
      </section>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Leave Type" : "Add Leave Type"}
        description="Choose a name, yearly quota and who it applies to."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveType.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Name *</label>
            <Input
              placeholder="e.g. Casual Leave"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Code *</label>
              <Input placeholder="CL" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Annual Quota (days) *</label>
              <Input
                type="number"
                min="1"
                max="365"
                value={quota}
                onChange={(e) => setQuota(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <Select
            label="Applies To"
            options={APPLIES_TO_OPTIONS}
            value={applicableTo}
            onChange={(e) => setApplicableTo(e.target.value as Applicability)}
          />
          {editing && (
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={String(isActive)}
              onChange={(e) => setIsActive(e.target.value === "true")}
            />
          )}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !code.trim() || !(quota >= 1) || saveType.isPending}
            >
              {saveType.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
