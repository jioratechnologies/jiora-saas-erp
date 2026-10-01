import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Network,
  Plus,
  Users,
  UserCheck,
  Shield,
  Trash2,
  Edit2,
  UserPlus,
  ArrowRight,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "../../api/client";
import { PageHeader } from "../../components/page-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Avatar } from "../../components/ui/avatar";
import { Modal } from "../../components/ui/modal";
import { QueryState } from "../../components/query-state";
import { useConfirm } from "../../hooks/use-confirm";
import { toast } from "../../components/ui/toast";
import { cn } from "../../lib/utils";

interface DeptPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  status: string;
  personType: string;
  managerId?: string | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  designation?: { id: string; name: string } | null;
  directReports?: Array<{ id: string; firstName: string; lastName: string }>;
}

interface DepartmentWithMembers {
  id: string;
  name: string;
  createdAt: string;
  persons: DeptPerson[];
}

interface AllPersonItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId?: string | null;
  managerId?: string | null;
  designation?: { name: string } | null;
  department?: { name: string } | null;
}

export function DepartmentTeamsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = useState("");
  const [createDeptOpen, setCreateDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);

  // Assign Member / Change Manager Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState<string>("");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [isAssigningHead, setIsAssigningHead] = useState(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);

  // Queries
  const { data: departments, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "departments", "rich"],
    queryFn: () => api.get<DepartmentWithMembers[]>("/admin/departments"),
  });

  const { data: allPeople } = useQuery({
    queryKey: ["hr", "people", "minimal"],
    queryFn: () => api.get<AllPersonItem[]>("/hr/persons"),
  });

  // Mutations
  const createDeptMutation = useMutation({
    mutationFn: () => api.post("/admin/departments", { name: newDeptName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "/admin/departments"] });
      toast.success("Department created", `"${newDeptName}" added successfully.`);
      setNewDeptName("");
      setCreateDeptOpen(false);
    },
    onError: (err: any) => {
      toast.error("Failed to create department", err.message);
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "/admin/departments"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      toast.success("Department deleted", "The department has been removed.");
    },
    onError: (err: any) => {
      toast.error("Failed to delete department", err.message);
    },
  });

  const updatePersonDeptMutation = useMutation({
    mutationFn: async ({
      personId,
      departmentId,
      managerId,
    }: {
      personId: string;
      departmentId: string | null;
      managerId?: string | null;
    }) => {
      return api.patch(`/hr/persons/${personId}`, {
        departmentId,
        ...(managerId !== undefined ? { managerId } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "/admin/departments"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance"] });
      toast.success("Hierarchy updated", "Department and reporting manager updated successfully.");
      setAssignModalOpen(false);
      setSelectedPersonId("");
      setSelectedManagerId("");
    },
    onError: (err: any) => {
      toast.error("Failed to update hierarchy", err.message);
    },
  });

  // Compute statistics
  const totalDepts = departments?.length || 0;
  const totalAssignedStaff = (departments || []).reduce((acc, d) => acc + (d.persons?.length || 0), 0);
  const managersCount = (departments || []).reduce((acc, d) => {
    const managersInDept = (d.persons || []).filter((p) => p.directReports && p.directReports.length > 0);
    return acc + managersInDept.length;
  }, 0);
  const unassignedStaffCount = (allPeople || []).filter((p) => !p.departmentId).length;

  const filteredDepts = (departments || []).filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const deptMatch = d.name.toLowerCase().includes(q);
    const personMatch = (d.persons || []).some(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.designation?.name?.toLowerCase().includes(q),
    );
    return deptMatch || personMatch;
  });

  const openAssignModal = (deptId: string, forHead: boolean = false) => {
    setTargetDeptId(deptId);
    setIsAssigningHead(forHead);
    setSelectedPersonId("");
    setSelectedManagerId("");
    setOnlyUnassigned(true);
    setAssignModalOpen(true);
  };

  const openReassignPersonModal = (person: DeptPerson, deptId: string) => {
    setTargetDeptId(deptId);
    setSelectedPersonId(person.id);
    setSelectedManagerId(person.managerId || "");
    setIsAssigningHead(false);
    setOnlyUnassigned(false);
    setAssignModalOpen(true);
  };

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6 w-full">
      {/* Sticky Enterprise Header */}
      <PageHeader
        title="Department Teams & Managers"
        description="View and manage staff, lead managers, and reporting lines department-wise across your organisation."
        icon={Network}
        badge={{ label: `${totalDepts} Departments`, variant: "secondary" }}
        stats={[
          { label: "Departments", value: totalDepts },
          { label: "Assigned Staff", value: totalAssignedStaff, color: "text-primary" },
          { label: "Active Managers", value: managersCount, color: "text-emerald-600 dark:text-emerald-400" },
          {
            label: "Unassigned Staff",
            value: unassignedStaffCount,
            color: unassignedStaffCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setCreateDeptOpen(true)}
              className="gap-1.5 text-xs font-semibold rounded-xl h-8 px-2 sm:px-3"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">New Department</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search department, manager, or member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl h-9 text-xs w-full"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-muted-foreground">
          <span>Showing {filteredDepts.length} of {totalDepts} departments</span>
        </div>
      </div>

      {/* Departments Roster Grid */}
      <QueryState isLoading={isLoading} error={error}>
        {filteredDepts.length === 0 ? (
          <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <Network className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
            <h3 className="font-semibold text-foreground text-sm">No departments found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first department or adjust your search filter to view department rosters.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredDepts.map((dept) => {
              const members = dept.persons || [];
              // Find lead managers (persons who have direct reports or senior leadership designation)
              const managers = members.filter(
                (p) => (p.directReports && p.directReports.length > 0) || p.designation?.name?.toLowerCase().includes("lead") || p.designation?.name?.toLowerCase().includes("manager") || p.designation?.name?.toLowerCase().includes("director")
              );
              const leadManager = managers[0] || null;
              const isExpanded = expandedDeptId === dept.id;

              return (
                <Card
                  key={dept.id}
                  className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-bold text-foreground truncate">
                            {dept.name}
                          </CardTitle>
                          <Badge variant="outline" className="text-[11px] font-mono">
                            {members.length} {members.length === 1 ? "member" : "members"}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-0.5">
                          {managers.length} {managers.length === 1 ? "manager / lead" : "managers / leads"} designated
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAssignModal(dept.id, false)}
                          className="h-8 px-2 sm:px-2.5 text-xs text-primary hover:bg-primary/10 gap-1 rounded-lg"
                          title="Add staff to department"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Add Staff</span>
                          <span className="sm:hidden">Add</span>
                        </Button>

                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Delete "${dept.name}" Department?`,
                              description: `This department currently has ${members.length} staff members assigned. Deleting will unassign members from this department.`,
                              confirmLabel: "Delete Department",
                            });
                            if (ok) deleteDeptMutation.mutate(dept.id);
                          }}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                          title="Delete Department"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 pb-4 space-y-4 flex-1">
                    {/* Department Head / Lead Manager Card */}
                    <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/50 p-3.5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-primary" />
                          Department Lead / Manager
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAssignModal(dept.id, true)}
                          className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 font-medium"
                        >
                          {leadManager ? "Change Lead" : "+ Assign Lead"}
                        </Button>
                      </div>

                      {leadManager ? (
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={`${leadManager.firstName} ${leadManager.lastName}`}
                            src={leadManager.avatarUrl}
                            size="sm"
                            className="h-9 w-9"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-foreground truncate">
                                {leadManager.firstName} {leadManager.lastName}
                              </p>
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                                Manager
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {leadManager.designation?.name || "No designation"} • {leadManager.email}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic py-1">
                          No department manager assigned yet. Click above to designate a lead.
                        </p>
                      )}
                    </div>

                    {/* Team Members List / Preview */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          Team Members ({members.length})
                        </span>
                        {members.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setExpandedDeptId(isExpanded ? null : dept.id)}
                            className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                          >
                            {isExpanded ? (
                              <>
                                <span>Collapse</span>
                                <ChevronUp className="h-3.5 w-3.5" />
                              </>
                            ) : (
                              <>
                                <span>View all ({members.length})</span>
                                <ChevronDown className="h-3.5 w-3.5" />
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {members.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-muted-foreground">
                          No personnel assigned to this department yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(isExpanded ? members : members.slice(0, 3)).map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar
                                  name={`${m.firstName} ${m.lastName}`}
                                  src={m.avatarUrl}
                                  size="sm"
                                  className="h-8 w-8 text-xs shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-semibold text-foreground truncate">
                                      {m.firstName} {m.lastName}
                                    </span>
                                    <Badge
                                      variant={m.personType === "EMPLOYEE" ? "outline" : "secondary"}
                                      className="text-[10px] py-0 px-1"
                                    >
                                      {m.personType === "EMPLOYEE" ? "Emp" : "Vol"}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {m.designation?.name || "No designation"}
                                    {m.manager && (
                                      <span className="text-zinc-400 dark:text-zinc-500">
                                        {" "}• Reports to: <strong className="text-foreground font-medium">{m.manager.firstName} {m.manager.lastName}</strong>
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openReassignPersonModal(m, dept.id)}
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                                title="Change Manager or Department"
                              >
                                Edit Role
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </QueryState>

      {/* Modal: Create Department */}
      <Modal
        isOpen={createDeptOpen}
        onClose={() => setCreateDeptOpen(false)}
        title="Create New Department"
        description="Add a department name to organize your organization's teams."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newDeptName.trim()) createDeptMutation.mutate();
          }}
          className="space-y-4 pt-2"
        >
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Department Name *</label>
            <Input
              placeholder="e.g. Operations, Technology, Accounts"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              required
              className="rounded-xl"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button variant="ghost" type="button" onClick={() => setCreateDeptOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newDeptName.trim() || createDeptMutation.isPending}>
              {createDeptMutation.isPending ? "Creating..." : "Create Department"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign / Reassign Staff and Manager */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={isAssigningHead ? "Designate Department Lead / Manager" : "Manage Member Department & Manager"}
        description="Changes will instantly update employee records and reporting hierarchy across the entire system."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          {/* Staff Member Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Staff Member / Person *
              </label>
              {!isAssigningHead && (
                <button
                  type="button"
                  onClick={() => setOnlyUnassigned(!onlyUnassigned)}
                  className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{onlyUnassigned ? "Showing non-assigned only" : "Showing all staff"}</span>
                  <span className="text-muted-foreground">({onlyUnassigned ? "Show all" : "Non-assigned only"})</span>
                </button>
              )}
            </div>
            <Select
              value={selectedPersonId}
              onChange={(e) => {
                const pid = e.target.value;
                setSelectedPersonId(pid);
                const found = (allPeople || []).find((p) => p.id === pid);
                if (found?.managerId) setSelectedManagerId(found.managerId);
              }}
              options={[
                {
                  label: (allPeople || []).filter((p) => {
                    if (isAssigningHead) return true;
                    if (selectedPersonId && p.id === selectedPersonId) return true;
                    if (onlyUnassigned) return !p.departmentId && !p.department;
                    return true;
                  }).length === 0
                    ? "-- No non-assigned staff found (Click 'Show all' above) --"
                    : "-- Select a staff member --",
                  value: "",
                },
                ...(allPeople || [])
                  .filter((p) => {
                    if (isAssigningHead) return true;
                    if (selectedPersonId && p.id === selectedPersonId) return true;
                    if (onlyUnassigned) return !p.departmentId && !p.department;
                    return true;
                  })
                  .map((p) => ({
                    label: `${p.firstName} ${p.lastName} (${p.designation?.name || "Staff"} • ${p.department?.name || "No Dept"})`,
                    value: p.id,
                  })),
              ]}
              className="w-full rounded-xl"
            />
          </div>

          {/* Department Selector */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Assigned Department *</label>
            <Select
              value={targetDeptId}
              onChange={(e) => setTargetDeptId(e.target.value)}
              options={(departments || []).map((d) => ({
                label: d.name,
                value: d.id,
              }))}
              className="w-full rounded-xl"
            />
          </div>

          {/* Reporting Manager Selector */}
          {!isAssigningHead && (
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Reporting Manager / Supervisor
              </label>
              <Select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                options={[
                  { label: "None (Direct / Senior Leadership)", value: "" },
                  ...(allPeople || [])
                    .filter((p) => p.id !== selectedPersonId)
                    .map((p) => ({
                      label: `${p.firstName} ${p.lastName} (${p.designation?.name || "Manager"} • ${p.department?.name || "General"})`,
                      value: p.id,
                    })),
                ]}
                className="w-full rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave as 'None' if this person reports directly to the executive leadership or is a department head.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button variant="ghost" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedPersonId) {
                  toast.error("Please select a person");
                  return;
                }
                updatePersonDeptMutation.mutate({
                  personId: selectedPersonId,
                  departmentId: targetDeptId,
                  managerId: isAssigningHead ? null : selectedManagerId || null,
                });
              }}
              disabled={!selectedPersonId || updatePersonDeptMutation.isPending}
            >
              {updatePersonDeptMutation.isPending ? "Updating..." : "Save Assignment"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
