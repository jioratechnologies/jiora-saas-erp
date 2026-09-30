import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  UserMinus,
  Mail,
  Search,
  Filter,
  Shield,
  Building2,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  ChevronDown,
  X,
  UserCheck,
  Crown,
  Code2,
  User as UserIcon,
} from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Avatar, User } from "../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { Modal } from "../components/ui/modal";
import { HeaderActionPortal } from "../components/header-action-portal";
import { Pagination, usePagination } from "../components/ui/pagination";
import { useConfirm } from "../hooks/use-confirm";
import { toast } from "../components/ui/toast";
import { formatErrorMessage } from "../lib/error-formatter";
import { cn } from "../lib/utils";

interface RoleOption {
  id: string;
  name: string;
  isProtected?: boolean;
  permissions?: { permissionKey: string }[];
}

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  zitadelSubjectId: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
  roles: { role: RoleOption }[];
}

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
}

/** Visual styling for role badges */
function getRoleBadgeStyle(name: string) {
  const lower = name.toLowerCase();
  if (lower === "admin") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
  if (lower.includes("hr")) {
    return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30";
  }
  if (lower.includes("developer") || lower.includes("tech") || lower.includes("engineer")) {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
  }
  if (lower.includes("employee") || lower.includes("staff")) {
    return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30";
  }
  return "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-zinc-200 dark:border-zinc-700";
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const usersKey = ["admin", "users"];

  // Queries
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({ queryKey: usersKey, queryFn: () => api.get<UserRow[]>("/admin/users") });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.get<RoleOption[]>("/admin/roles"),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["admin", "/admin/departments"],
    queryFn: () => api.get<Department[]>("/admin/departments"),
  });

  const { data: designations = [] } = useQuery({
    queryKey: ["admin", "/admin/designations"],
    queryFn: () => api.get<Designation[]>("/admin/designations"),
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "deactivated">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteDepartmentId, setInviteDepartmentId] = useState<string>("");
  const [inviteDesignationId, setInviteDesignationId] = useState<string>("");
  const [inviteSelectedRoles, setInviteSelectedRoles] = useState<Set<string>>(new Set());

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: () =>
      api.post("/admin/users/invite", {
        email: inviteEmail.trim(),
        displayName: inviteName.trim(),
        departmentId: inviteDepartmentId || undefined,
        designationId: inviteDesignationId || undefined,
        roleIds: Array.from(inviteSelectedRoles),
      }),
    onSuccess: () => {
      const email = inviteEmail.trim();
      setInviteEmail("");
      setInviteName("");
      setInviteDepartmentId("");
      setInviteDesignationId("");
      setInviteSelectedRoles(new Set());
      setInviteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: usersKey });
      toast.success("Invitation dispatched", `An onboarding invitation has been sent to ${email}.`);
    },
    onError: (err) => {
      toast.error("Failed to invite user", formatErrorMessage(err));
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKey });
      toast.success("User deactivated", "The user's access has been disabled.");
    },
    onError: (err) => {
      toast.error("Failed to deactivate user", formatErrorMessage(err));
    },
  });

  // Filtering users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.displayName.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }

      // Status filter
      if (statusFilter === "active" && (!u.zitadelSubjectId || u.deactivatedAt)) return false;
      if (statusFilter === "pending" && (u.zitadelSubjectId !== null || u.deactivatedAt)) return false;
      if (statusFilter === "deactivated" && !u.deactivatedAt) return false;

      // Role filter
      if (roleFilter !== "all") {
        const hasRole = u.roles.some((r) => r.role.id === roleFilter);
        if (!hasRole) return false;
      }

      return true;
    });
  }, [users, searchQuery, statusFilter, roleFilter]);

  // Pagination (10 per page)
  const pagination = usePagination(filteredUsers, 10);

  // KPI stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.zitadelSubjectId && !u.deactivatedAt).length;
    const pending = users.filter((u) => !u.zitadelSubjectId && !u.deactivatedAt).length;
    const deactivated = users.filter((u) => Boolean(u.deactivatedAt)).length;

    return [
      { label: "Total Members", value: total },
      { label: "Active Accounts", value: active },
      { label: "Pending Invites", value: pending },
      { label: "Deactivated", value: deactivated },
    ];
  }, [users]);

  // Open invite modal
  const handleOpenInvite = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteDepartmentId("");
    setInviteDesignationId("");
    // Default to Employee role if available
    const empRole = roles.find((r) => r.name.toLowerCase().includes("employee"));
    setInviteSelectedRoles(new Set(empRole ? [empRole.id] : []));
    setInviteModalOpen(true);
  };

  const toggleInviteRole = (roleId: string) => {
    const next = new Set(inviteSelectedRoles);
    if (next.has(roleId)) {
      next.delete(roleId);
    } else {
      next.add(roleId);
    }
    setInviteSelectedRoles(next);
  };

  return (
    <div className="max-w-[1720px] mx-auto space-y-5 px-3 sm:px-6 py-4">
      {/* Top Header Portal Button */}
      <HeaderActionPortal>
        <Button onClick={handleOpenInvite} size="sm" className="h-9 gap-1.5 font-medium shadow-xs">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Invite Member</span>
          <span className="sm:hidden">Invite</span>
        </Button>
      </HeaderActionPortal>

      {/* Modern Page Header */}
      <PageHeader
        title="User Management"
        description="Invite personnel, assign role-based permissions, and manage organization membership."
        icon={Users}
        stats={stats}
        action={
          <Button onClick={handleOpenInvite} className="h-9 gap-1.5 font-medium shadow-xs">
            <UserPlus className="h-4 w-4" />
            <span>Invite Team Member</span>
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Tabs & Role Dropdown */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Status Pills */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
                {[
                  { id: "all", label: "All" },
                  { id: "active", label: "Active" },
                  { id: "pending", label: "Pending" },
                  { id: "deactivated", label: "Deactivated" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                      statusFilter === tab.id
                        ? "bg-white dark:bg-zinc-900 text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Role Filter Select */}
              <div className="relative">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-9 px-3 pr-8 text-xs font-medium bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none"
                >
                  <option value="all">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <QueryState isLoading={usersLoading} error={usersError}>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40">
                    <TableHead className="w-[320px] font-semibold text-xs">User Profile</TableHead>
                    <TableHead className="font-semibold text-xs">Department & Placement</TableHead>
                    <TableHead className="font-semibold text-xs">Assigned Roles</TableHead>
                    <TableHead className="font-semibold text-xs">Identity Status</TableHead>
                    <TableHead className="w-12 text-right pr-4 font-semibold text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((u) => {
                    const isDeactivated = Boolean(u.deactivatedAt);
                    const isClaimed = Boolean(u.zitadelSubjectId);

                    return (
                      <TableRow
                        key={u.id}
                        className={cn(
                          "border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors",
                          isDeactivated && "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/20",
                        )}
                      >
                        {/* User Profile Cell */}
                        <TableCell className="py-3 px-4">
                          <User
                            name={u.displayName}
                            description={u.email}
                            avatarProps={{
                              size: "md",
                              isBordered: true,
                              status: isDeactivated ? undefined : isClaimed ? "online" : undefined,
                            }}
                          />
                        </TableCell>

                        {/* Department & Placement Cell */}
                        <TableCell className="py-3 px-4">
                          {u.department || u.designation ? (
                            <div className="space-y-0.5">
                              {u.designation && (
                                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                                  {u.designation.name}
                                </p>
                              )}
                              {u.department && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                  <Building2 className="h-3 w-3 text-muted-foreground" />
                                  {u.department.name}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Unassigned</span>
                          )}
                        </TableCell>

                        {/* Assigned Roles Cell */}
                        <TableCell className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {u.roles.map((r) => (
                              <Badge
                                key={r.role.name}
                                variant="outline"
                                className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md", getRoleBadgeStyle(r.role.name))}
                              >
                                {r.role.name}
                              </Badge>
                            ))}
                            {u.roles.length === 0 && (
                              <span className="text-xs text-muted-foreground italic">No roles</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Identity Status Cell */}
                        <TableCell className="py-3 px-4">
                          {isDeactivated ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5 font-medium bg-destructive/10 text-destructive border-destructive/30 rounded-md gap-1"
                            >
                              <X className="h-3 w-3" />
                              Deactivated
                            </Badge>
                          ) : isClaimed ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5 font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 rounded-md gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5 font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 rounded-md gap-1"
                            >
                              <Clock className="h-3 w-3" />
                              Invite Pending
                            </Badge>
                          )}
                        </TableCell>

                        {/* Action Cell */}
                        <TableCell className="py-3 px-4 text-right">
                          {!isDeactivated ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Deactivate ${u.displayName}?`,
                                  description: `${u.email} will immediately lose access to this organization. You can contact an administrator to reverse this later.`,
                                  confirmLabel: "Deactivate User",
                                });
                                if (ok) deactivateMutation.mutate(u.id);
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                              title="Deactivate User"
                            >
                              <UserMinus className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center">
                        <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-foreground">No matching users</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Try adjusting your search criteria or invite a new member.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List View */}
            <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {pagination.paginatedItems.map((u) => {
                const isDeactivated = Boolean(u.deactivatedAt);
                const isClaimed = Boolean(u.zitadelSubjectId);

                return (
                  <div key={u.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <User
                        name={u.displayName}
                        description={u.email}
                        avatarProps={{
                          size: "sm",
                          isBordered: true,
                          status: isDeactivated ? undefined : isClaimed ? "online" : undefined,
                        }}
                      />
                      <div>
                        {isDeactivated ? (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                            Deactivated
                          </Badge>
                        ) : isClaimed ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    {(u.department || u.designation) && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        {u.designation && <span>{u.designation.name}</span>}
                        {u.department && u.designation && <span>•</span>}
                        {u.department && <span>{u.department.name}</span>}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r.role.name} variant="outline" className={cn("text-[10px] px-1.5 py-0", getRoleBadgeStyle(r.role.name))}>
                            {r.role.name}
                          </Badge>
                        ))}
                      </div>

                      {!isDeactivated && (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Deactivate ${u.displayName}?`,
                              description: `${u.email} will lose access immediately.`,
                              confirmLabel: "Deactivate",
                            });
                            if (ok) deactivateMutation.mutate(u.id);
                          }}
                          className="text-xs text-destructive hover:underline p-1"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="p-8 text-center">
                  <Users className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-medium text-foreground">No users found</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredUsers.length > 10 && (
              <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80">
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  pageSize={pagination.pageSize}
                  totalItems={pagination.totalItems}
                  onPageChange={pagination.setCurrentPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      {/* ── INVITE MEMBER MODAL ──────────────────────────────────────────────── */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Team Member"
        description="Dispatch an invitation for them to join your organisation. They can claim access using their email."
        maxWidth="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate();
          }}
          className="space-y-4"
        >
          {/* Email and Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Email Address <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                placeholder="name@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="h-9 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Display Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Full Name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                className="h-9 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
              />
            </div>
          </div>

          {/* Department and Designation Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Department</label>
              <select
                value={inviteDepartmentId}
                onChange={(e) => setInviteDepartmentId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">(None / Unassigned)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Designation</label>
              <select
                value={inviteDesignationId}
                onChange={(e) => setInviteDesignationId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">(None / Unassigned)</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Roles Selection Cards */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Assign Roles <span className="text-destructive">*</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                {inviteSelectedRoles.size} selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {roles.map((r) => {
                const isChecked = inviteSelectedRoles.has(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => toggleInviteRole(r.id)}
                    className={cn(
                      "p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none",
                      isChecked
                        ? "bg-primary/5 dark:bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                        : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Shield className={cn("h-4 w-4 shrink-0", isChecked ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-medium text-foreground truncate">{r.name}</span>
                    </div>

                    <div
                      className={cn(
                        "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-all",
                        isChecked
                          ? "bg-primary border-primary text-primary-foreground shadow-2xs"
                          : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950",
                      )}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInviteModalOpen(false)}
              className="h-8.5 text-xs font-medium rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                !inviteEmail.trim() ||
                !inviteName.trim() ||
                inviteSelectedRoles.size === 0 ||
                inviteMutation.isPending
              }
              className="h-8.5 text-xs font-medium rounded-xl gap-1.5 shadow-xs"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Send Invitation</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
