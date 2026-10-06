import { SearchInput } from "../components/ui/search-input";
import { useState, useMemo } from "react";
import { useMe } from "../auth/use-me";
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
  const { data: me } = useMe();
  const canInvite = Boolean(me?.permissionKeys?.includes("admin.user.invite"));
  const canDeactivate = Boolean(me?.permissionKeys?.includes("admin.user.deactivate"));
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "deactivated">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteDepartmentId, setInviteDepartmentId] = useState<string>("");
  const [inviteDesignationId, setInviteDesignationId] = useState<string>("");
  const [inviteAsAdmin, setInviteAsAdmin] = useState(false);
  const adminRoleId = roles.find((r) => r.isProtected)?.id;

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: () =>
      api.post("/admin/users/invite", {
        email: inviteEmail.trim(),
        displayName: inviteName.trim(),
        departmentId: inviteDepartmentId || undefined,
        designationId: inviteDesignationId,
        roleIds: inviteAsAdmin && adminRoleId ? [adminRoleId] : undefined,
      }),
    onSuccess: () => {
      const email = inviteEmail.trim();
      setInviteEmail("");
      setInviteName("");
      setInviteDepartmentId("");
      setInviteDesignationId("");
      setInviteAsAdmin(false);
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

  // Delete (permanent) mutation — deactivated users only
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKey });
      toast.success("User deleted", "The login was removed. The HR person record is kept.");
    },
    onError: (err) => {
      toast.error("Failed to delete user", formatErrorMessage(err));
    },
  });

  const confirmDelete = async (u: UserRow) => {
    const ok = await confirm({
      title: `Delete ${u.displayName} permanently?`,
      description: `${u.email}'s login will be removed and cannot be restored. Their HR person record is kept.`,
      confirmLabel: "Delete permanently",
      variant: "destructive",
    });
    if (ok) deleteMutation.mutate(u.id);
  };

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

      // Status filter ("all" hides deactivated users; they live under their own tab)
      if (statusFilter === "all" && u.deactivatedAt) return false;
      if (statusFilter === "active" && (!u.zitadelSubjectId || u.deactivatedAt)) return false;
      if (statusFilter === "pending" && (u.zitadelSubjectId !== null || u.deactivatedAt)) return false;
      if (statusFilter === "deactivated" && !u.deactivatedAt) return false;

      // Role filter
      if (roleFilter !== "all") {
        if (u.designation?.id !== roleFilter) return false;
      }

      return true;
    });
  }, [users, searchQuery, statusFilter, roleFilter]);

  // Pagination (10 per page)
  const pagination = usePagination(filteredUsers, 10);

  // KPI stats
  const stats = useMemo(() => {
    const total = users.filter((u) => !u.deactivatedAt).length;
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
    setInviteAsAdmin(false);
    setInviteModalOpen(true);
  };

  return (
    <div className="max-w-[1720px] mx-auto space-y-5 px-3 sm:px-6 py-4">
      {/* Modern Page Header */}
      <PageHeader
        title="User Management"
        description="Invite personnel, assign role-based permissions, and manage organization membership."
        icon={Users}
        stats={stats}
        action={
          canInvite ? (
            <Button onClick={handleOpenInvite} className="h-9 gap-1.5 font-medium shadow-xs">
              <UserPlus className="h-4 w-4" />
              <span>Invite</span>
            </Button>
          ) : undefined
        }
      />

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <SearchInput
 placeholder="Search by name or email address..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="flex-1 max-w-md"
 />

            {/* Filter Tabs & Role Dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {/* Status Pills */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl overflow-x-auto max-w-full [scrollbar-width:none] [&>button]:whitespace-nowrap">
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
                    {tab.id === "deactivated" && ` (${users.filter((u) => u.deactivatedAt).length})`}
                  </button>
                ))}
              </div>

              {/* Role Filter Select */}
              <div className="relative w-full sm:w-auto">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-10 sm:h-9 w-full sm:w-auto px-3 pr-8 text-sm sm:text-xs font-medium bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none"
                >
                  <option value="all">All Designations</option>
                  {designations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-3.5 sm:top-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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
                    <TableHead className="font-semibold text-xs">Access</TableHead>
                    <TableHead className="font-semibold text-xs">Status</TableHead>
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

                        {/* Access Cell */}
                        <TableCell className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {u.designation && (
                              <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 rounded-md">
                                {u.designation.name}
                              </Badge>
                            )}
                            {u.roles.some((r) => r.role.isProtected) && (
                              <Badge
                                variant="outline"
                                className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md", getRoleBadgeStyle("admin"))}
                              >
                                Admin
                              </Badge>
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
                            canDeactivate ? (
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
                            ) : null
                          ) : (
                            <button
                              type="button"
                              onClick={() => confirmDelete(u)}
                              className="px-2 py-1 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            >
                              Delete permanently
                            </button>
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
                        {u.designation && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {u.designation.name}
                          </Badge>
                        )}
                        {u.roles.some((r) => r.role.isProtected) && (
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getRoleBadgeStyle("admin"))}>
                            Admin
                          </Badge>
                        )}
                      </div>

                      {!isDeactivated && canDeactivate && (
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
                      {isDeactivated && (
                        <button
                          type="button"
                          onClick={() => confirmDelete(u)}
                          className="text-xs text-destructive hover:underline p-1"
                        >
                          Delete permanently
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
              <label className="block text-xs font-semibold text-foreground mb-1">
                Designation <span className="text-destructive">*</span>
              </label>
              <select
                required
                value={inviteDesignationId}
                onChange={(e) => setInviteDesignationId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select designation</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Organisation admin */}
          {adminRoleId && (
            <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inviteAsAdmin}
                onChange={(e) => setInviteAsAdmin(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-primary"
              />
              <span>
                <span className="font-semibold">Organisation admin</span>
                <span className="block text-[11px] text-muted-foreground">
                  Full access to everything. Other access comes from the designation.
                </span>
              </span>
            </label>
          )}

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
                !inviteDesignationId ||
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
