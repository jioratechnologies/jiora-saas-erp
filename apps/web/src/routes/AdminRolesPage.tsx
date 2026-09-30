import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Lock,
  Plus,
  Search,
  Trash2,
  Edit3,
  Copy,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  WalletCards,
  Check,
  Filter,
  Sparkles,
  Crown,
  Code2,
  User,
  Layers,
  ArrowRight,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import type { Permission } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { Modal } from "../components/ui/modal";
import { HeaderActionPortal } from "../components/header-action-portal";
import { useConfirm } from "../hooks/use-confirm";
import { toast } from "../components/ui/toast";
import { formatErrorMessage } from "../lib/error-formatter";
import { cn } from "../lib/utils";

interface RoleRow {
  id: string;
  name: string;
  isProtected: boolean;
  permissions: { permissionKey: string }[];
}

/** Pre-packaged preset templates to quickly scaffold common roles */
const ROLE_PRESETS = [
  {
    id: "all",
    label: "Full Admin",
    icon: Crown,
    desc: "All permissions across all modules",
    filter: () => true,
  },
  {
    id: "hr",
    label: "HR Specialist",
    icon: Users,
    desc: "Complete HR personnel, attendance, and leave management",
    filter: (p: Permission) => p.module === "hr",
  },
  {
    id: "payroll",
    label: "Payroll Manager",
    icon: WalletCards,
    desc: "Complete compensation, payroll runs, and claims approvals",
    filter: (p: Permission) => p.module === "payroll",
  },
  {
    id: "employee",
    label: "Employee Self-Service",
    icon: User,
    desc: "Basic punch in/out, leave application, payslip view, and expense claims",
    filter: (p: Permission) =>
      [
        "hr.attendance.checkin",
        "hr.attendance.read",
        "hr.leave.apply",
        "hr.leave.read",
        "hr.holiday.read",
        "payroll.payslip.read",
        "payroll.claim.apply",
        "payroll.claim.read",
        "payroll.advance.apply",
      ].includes(p.key),
  },
];

/** Visual styling and icons per role archetype */
function getRoleVisuals(name: string, isProtected: boolean) {
  const lower = name.toLowerCase();
  if (lower === "admin" || isProtected) {
    return {
      icon: Crown,
      bgGradient: "from-amber-500/15 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/15",
      textColor: "text-amber-700 dark:text-amber-400",
      borderColor: "border-amber-500/30 dark:border-amber-500/40",
      accentBar: "bg-amber-500",
      badgeVariant: "default" as const,
      badgeText: "System Protected",
    };
  }
  if (lower.includes("hr")) {
    return {
      icon: Users,
      bgGradient: "from-purple-500/15 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/15",
      textColor: "text-purple-700 dark:text-purple-400",
      borderColor: "border-purple-500/30 dark:border-purple-500/40",
      accentBar: "bg-purple-500",
      badgeVariant: "secondary" as const,
      badgeText: "Custom Role",
    };
  }
  if (lower.includes("developer") || lower.includes("tech") || lower.includes("engineer")) {
    return {
      icon: Code2,
      bgGradient: "from-blue-500/15 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/15",
      textColor: "text-blue-700 dark:text-blue-400",
      borderColor: "border-blue-500/30 dark:border-blue-500/40",
      accentBar: "bg-blue-500",
      badgeVariant: "secondary" as const,
      badgeText: "Custom Role",
    };
  }
  if (lower.includes("employee") || lower.includes("staff")) {
    return {
      icon: User,
      bgGradient: "from-teal-500/15 to-emerald-500/10 dark:from-teal-500/20 dark:to-emerald-500/15",
      textColor: "text-teal-700 dark:text-teal-400",
      borderColor: "border-teal-500/30 dark:border-teal-500/40",
      accentBar: "bg-teal-500",
      badgeVariant: "secondary" as const,
      badgeText: "Custom Role",
    };
  }
  return {
    icon: ShieldCheck,
    bgGradient: "from-indigo-500/15 to-primary/10 dark:from-indigo-500/20 dark:to-primary/15",
    textColor: "text-primary dark:text-primary",
    borderColor: "border-primary/30 dark:border-primary/40",
    accentBar: "bg-primary",
    badgeVariant: "secondary" as const,
    badgeText: "Custom Role",
  };
}

const MODULE_METADATA: Record<string, { label: string; icon: typeof Building2; description: string }> = {
  admin: {
    label: "Administration",
    icon: Building2,
    description: "Company profile, settings, departments, designations, users, and roles management",
  },
  hr: {
    label: "HR Core",
    icon: Users,
    description: "Staff directory, biometric attendance, leave ledger, approvals, and annual holidays",
  },
  payroll: {
    label: "Payroll & Claims",
    icon: WalletCards,
    description: "Salary structures, appraisal history, monthly payroll calculations, payslips, and expense claims",
  },
};

/** Redesigned Master-Detail Roles & Access Control Center */
export function AdminRolesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const rolesKey = ["admin", "roles"];

  const {
    data: roles = [],
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery({ queryKey: rolesKey, queryFn: () => api.get<RoleRow[]>("/admin/roles") });

  const { data: catalog = [] } = useQuery({
    queryKey: ["admin", "roles", "permission-catalog"],
    queryFn: () => api.get<Permission[]>("/admin/roles/permission-catalog"),
  });

  // Selected role in inspector panel
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Inspector filters
  const [roleSearch, setRoleSearch] = useState("");
  const [inspectorSearch, setInspectorSearch] = useState("");
  const [inspectorModule, setInspectorModule] = useState<string>("all");
  const [showGrantedOnly, setShowGrantedOnly] = useState(true);

  // Builder Modal State
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<"create" | "edit">("create");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState("");
  const [builderSelectedKeys, setBuilderSelectedKeys] = useState<Set<string>>(new Set());
  const [builderSearch, setBuilderSearch] = useState("");
  const [builderModule, setBuilderModule] = useState<string>("all");

  // Determine active role
  const activeRole = useMemo(() => {
    if (!roles || roles.length === 0) return null;
    if (selectedRoleId) {
      const found = roles.find((r) => r.id === selectedRoleId);
      if (found) return found;
    }
    return roles[0];
  }, [roles, selectedRoleId]);

  // Catalog grouped by module
  const catalogGrouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of catalog) {
      map.set(p.module, [...(map.get(p.module) ?? []), p]);
    }
    return map;
  }, [catalog]);

  // Filtered roles in list
  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return roles;
    const q = roleSearch.toLowerCase();
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, roleSearch]);

  // Active role permissions set
  const activeRolePermSet = useMemo(() => {
    if (!activeRole) return new Set<string>();
    return new Set(activeRole.permissions.map((p) => p.permissionKey));
  }, [activeRole]);

  // Create role mutation
  const createMutation = useMutation({
    mutationFn: () =>
      api.post<RoleRow>("/admin/roles", {
        name: builderName.trim(),
        permissionKeys: Array.from(builderSelectedKeys),
      }),
    onSuccess: (newRole) => {
      queryClient.invalidateQueries({ queryKey: rolesKey });
      setSelectedRoleId(newRole.id);
      setBuilderOpen(false);
      toast.success(
        "Role created",
        `"${builderName.trim()}" created successfully with ${builderSelectedKeys.size} permission${
          builderSelectedKeys.size === 1 ? "" : "s"
        }.`,
      );
    },
    onError: (err) => {
      toast.error("Failed to create role", formatErrorMessage(err));
    },
  });

  // Update role mutation
  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch<RoleRow>(`/admin/roles/${editingRoleId}`, {
        name: builderName.trim(),
        permissionKeys: Array.from(builderSelectedKeys),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKey });
      setBuilderOpen(false);
      toast.success(
        "Role updated",
        `"${builderName.trim()}" updated successfully with ${builderSelectedKeys.size} permission${
          builderSelectedKeys.size === 1 ? "" : "s"
        }.`,
      );
    },
    onError: (err) => {
      toast.error("Failed to update role", formatErrorMessage(err));
    },
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKey });
      setSelectedRoleId(null);
      toast.success("Role deleted", "Custom role deleted successfully.");
    },
    onError: (err) => {
      toast.error("Failed to delete role", formatErrorMessage(err));
    },
  });

  // Open builder for creating a fresh role
  const handleOpenCreate = () => {
    setBuilderMode("create");
    setEditingRoleId(null);
    setBuilderName("");
    setBuilderSelectedKeys(new Set());
    setBuilderSearch("");
    setBuilderModule("all");
    setBuilderOpen(true);
  };

  // Open builder for editing an existing role
  const handleOpenEdit = (role: RoleRow) => {
    if (role.isProtected) return;
    setBuilderMode("edit");
    setEditingRoleId(role.id);
    setBuilderName(role.name);
    setBuilderSelectedKeys(new Set(role.permissions.map((p) => p.permissionKey)));
    setBuilderSearch("");
    setBuilderModule("all");
    setBuilderOpen(true);
  };

  // Clone an existing role into the builder
  const handleCloneRole = (role: RoleRow) => {
    setBuilderMode("create");
    setEditingRoleId(null);
    setBuilderName(`${role.name} Copy`);
    setBuilderSelectedKeys(new Set(role.permissions.map((p) => p.permissionKey)));
    setBuilderSearch("");
    setBuilderModule("all");
    setBuilderOpen(true);
    toast.info("Role cloned as template", `Pre-filled builder with permissions from "${role.name}".`);
  };

  // Delete confirmation
  const handleDeleteRole = async (role: RoleRow) => {
    if (role.isProtected) return;
    const ok = await confirm({
      title: `Delete role "${role.name}"?`,
      description: `Anyone holding this role loses its ${role.permissions.length} permission${
        role.permissions.length === 1 ? "" : "s"
      } immediately. This action cannot be undone.`,
      confirmLabel: "Delete role",
    });
    if (ok) {
      deleteMutation.mutate(role.id);
    }
  };

  // Apply a preset in builder
  const handleApplyPreset = (preset: (typeof ROLE_PRESETS)[0]) => {
    const keys = new Set<string>();
    for (const p of catalog) {
      if (preset.filter(p)) {
        keys.add(p.key);
      }
    }
    setBuilderSelectedKeys(keys);
    toast.info(`Applied ${preset.label}`, `Selected ${keys.size} permissions.`);
  };

  // Toggle single permission key in builder
  const handleToggleKey = (key: string) => {
    const next = new Set(builderSelectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setBuilderSelectedKeys(next);
  };

  // Toggle all permissions in a module in builder
  const handleToggleModule = (module: string) => {
    const modulePerms = catalog.filter((p) => p.module === module);
    const allSelected = modulePerms.every((p) => builderSelectedKeys.has(p.key));
    const next = new Set(builderSelectedKeys);

    if (allSelected) {
      for (const p of modulePerms) next.delete(p.key);
    } else {
      for (const p of modulePerms) next.add(p.key);
    }
    setBuilderSelectedKeys(next);
  };

  // KPI stats for PageHeader
  const headerStats = useMemo(() => {
    const totalRoles = roles.length;
    const protectedCount = roles.filter((r) => r.isProtected).length;
    const customCount = totalRoles - protectedCount;
    const totalPerms = catalog.length;

    return [
      { label: "Total Roles", value: totalRoles },
      { label: "System Roles", value: protectedCount },
      { label: "Custom Roles", value: customCount },
      { label: "Permission Catalog", value: totalPerms },
    ];
  }, [roles, catalog]);

  return (
    <div className="max-w-[1720px] mx-auto space-y-5 px-3 sm:px-6 py-4">
      {/* Dynamic Header Portal Action for Desktop Topbar */}
      <HeaderActionPortal>
        <Button onClick={handleOpenCreate} size="sm" className="h-9 gap-1.5 font-medium shadow-xs">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Custom Role</span>
          <span className="sm:hidden">New Role</span>
        </Button>
      </HeaderActionPortal>

      {/* Modern Sticky Page Header */}
      <PageHeader
        title="Roles & Access Control"
        description="Configure granular role-based permissions across system administration, HR personnel, and payroll operations."
        icon={ShieldCheck}
        stats={headerStats}
        action={
          <Button onClick={handleOpenCreate} className="h-9 gap-1.5 font-medium shadow-xs">
            <Plus className="h-4 w-4" />
            <span>Create Custom Role</span>
          </Button>
        }
      />

      <QueryState isLoading={rolesLoading} error={rolesError}>
        {/* Main Master-Detail Workstation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ── LEFT PANE: Roles Directory (4 cols) ────────────────────────────────── */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Available Roles</h2>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                  {roles.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenCreate}
                className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            </div>

            {/* Role Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                className="h-9 pl-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 rounded-xl"
              />
            </div>

            {/* Roles List */}
            <div className="space-y-2.5 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
              {filteredRoles.map((role) => {
                const isSelected = activeRole?.id === role.id;
                const visuals = getRoleVisuals(role.name, role.isProtected);
                const IconComponent = visuals.icon;
                const permCount = role.permissions.length;
                const totalCatalogCount = catalog.length || 36;
                const percentage = Math.round((permCount / totalCatalogCount) * 100);

                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={cn(
                      "group relative flex flex-col p-3.5 rounded-xl border transition-all duration-150 cursor-pointer text-left select-none",
                      isSelected
                        ? "bg-primary/5 dark:bg-primary/10 border-primary/40 shadow-sm ring-1 ring-primary/30"
                        : "bg-white dark:bg-zinc-900/90 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-800/90 shadow-xs",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br border transition-transform group-hover:scale-105",
                            visuals.bgGradient,
                            visuals.borderColor,
                            visuals.textColor,
                          )}
                        >
                          <IconComponent className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-foreground truncate">{role.name}</span>
                            {role.isProtected ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 rounded-md"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                Protected
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 font-medium bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-zinc-200 dark:border-zinc-700 rounded-md"
                              >
                                Custom
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {permCount} of {totalCatalogCount} permissions ({percentage}%)
                          </p>
                        </div>
                      </div>

                      {/* Quick Actions Menu */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {!role.isProtected && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(role)}
                            className="p-1 rounded-lg text-muted-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-foreground transition-colors"
                            title="Edit Role"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCloneRole(role)}
                          className="p-1 rounded-lg text-muted-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-foreground transition-colors"
                          title="Clone as Template"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {!role.isProtected && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(role)}
                            className="p-1 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete Role"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Permission Progress Bar */}
                    <div className="mt-3 w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", visuals.accentBar)}
                        style={{ width: `${Math.max(percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {filteredRoles.length === 0 && (
                <div className="py-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <ShieldAlert className="h-7 w-7 text-muted-foreground/60 mx-auto mb-2" />
                  <p className="text-xs font-medium text-foreground">No matching roles</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Try searching with a different term.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANE: Role Inspector & Permission Catalog (8 cols) ──────────── */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-4">
            {activeRole ? (
              <>
                {/* Active Role Highlight Card */}
                {(() => {
                  const visuals = getRoleVisuals(activeRole.name, activeRole.isProtected);
                  const IconComponent = visuals.icon;
                  const permCount = activeRole.permissions.length;
                  const totalCatalogCount = catalog.length || 36;

                  // Module breakdown counts
                  const adminPerms = catalog.filter((p) => p.module === "admin");
                  const hrPerms = catalog.filter((p) => p.module === "hr");
                  const payrollPerms = catalog.filter((p) => p.module === "payroll");

                  const activeAdmin = adminPerms.filter((p) => activeRolePermSet.has(p.key)).length;
                  const activeHr = hrPerms.filter((p) => activeRolePermSet.has(p.key)).length;
                  const activePayroll = payrollPerms.filter((p) => activeRolePermSet.has(p.key)).length;

                  return (
                    <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div
                              className={cn(
                                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br border shadow-xs",
                                visuals.bgGradient,
                                visuals.borderColor,
                                visuals.textColor,
                              )}
                            >
                              <IconComponent className="h-6 w-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-bold text-foreground tracking-tight">{activeRole.name}</h2>
                                {activeRole.isProtected ? (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1.5 rounded-lg"
                                  >
                                    <Lock className="h-3 w-3" />
                                    System Role
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 rounded-lg"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    Custom Role
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Granted {permCount} of {totalCatalogCount} system privileges
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {!activeRole.isProtected ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEdit(activeRole)}
                                  className="h-8 gap-1.5 text-xs font-medium rounded-xl border-zinc-200 dark:border-zinc-800"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Edit Permissions
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCloneRole(activeRole)}
                                  className="h-8 gap-1.5 text-xs font-medium rounded-xl border-zinc-200 dark:border-zinc-800"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Clone
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteRole(activeRole)}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl"
                                  title="Delete Role"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCloneRole(activeRole)}
                                className="h-8 gap-1.5 text-xs font-medium rounded-xl border-zinc-200 dark:border-zinc-800"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Clone as Template
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Module Distribution Ribbon */}
                        <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-3 gap-2.5">
                          <div
                            onClick={() => setInspectorModule("admin")}
                            className={cn(
                              "p-2.5 rounded-xl border transition-all cursor-pointer text-left",
                              inspectorModule === "admin"
                                ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                                : "bg-zinc-50/70 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50",
                            )}
                          >
                            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                              <span className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                                Admin
                              </span>
                              <span className="text-[11px] font-semibold text-foreground">
                                {activeAdmin}/{adminPerms.length}
                              </span>
                            </div>
                            <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-indigo-500 h-full rounded-full"
                                style={{ width: `${(activeAdmin / (adminPerms.length || 1)) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div
                            onClick={() => setInspectorModule("hr")}
                            className={cn(
                              "p-2.5 rounded-xl border transition-all cursor-pointer text-left",
                              inspectorModule === "hr"
                                ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                                : "bg-zinc-50/70 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50",
                            )}
                          >
                            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                              <span className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-purple-500" />
                                HR Core
                              </span>
                              <span className="text-[11px] font-semibold text-foreground">
                                {activeHr}/{hrPerms.length}
                              </span>
                            </div>
                            <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-purple-500 h-full rounded-full"
                                style={{ width: `${(activeHr / (hrPerms.length || 1)) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div
                            onClick={() => setInspectorModule("payroll")}
                            className={cn(
                              "p-2.5 rounded-xl border transition-all cursor-pointer text-left",
                              inspectorModule === "payroll"
                                ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                                : "bg-zinc-50/70 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50",
                            )}
                          >
                            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
                              <span className="flex items-center gap-1.5">
                                <WalletCards className="h-3.5 w-3.5 text-emerald-500" />
                                Payroll
                              </span>
                              <span className="text-[11px] font-semibold text-foreground">
                                {activePayroll}/{payrollPerms.length}
                              </span>
                            </div>
                            <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${(activePayroll / (payrollPerms.length || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })()}

                {/* Filter and View Mode Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {[
                      { id: "all", label: "All Modules" },
                      { id: "admin", label: "Admin" },
                      { id: "hr", label: "HR Core" },
                      { id: "payroll", label: "Payroll & Claims" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setInspectorModule(tab.id)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer",
                          inspectorModule === tab.id
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground",
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-48">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Filter permissions..."
                        value={inspectorSearch}
                        onChange={(e) => setInspectorSearch(e.target.value)}
                        className="h-8 pl-7 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-lg"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowGrantedOnly(!showGrantedOnly)}
                      className={cn(
                        "h-8 px-2.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer",
                        showGrantedOnly
                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60"
                          : "bg-zinc-50 dark:bg-zinc-950 text-muted-foreground border-zinc-200 dark:border-zinc-800 hover:text-foreground",
                      )}
                      title="Toggle between granted permissions and complete catalog comparison"
                    >
                      <Filter className="h-3 w-3" />
                      <span>{showGrantedOnly ? "Granted Only" : "Full Catalog"}</span>
                    </button>
                  </div>
                </div>

                {/* Categorized Permissions Grid */}
                <div className="space-y-4">
                  {Array.from(catalogGrouped.entries())
                    .filter(([mod]) => inspectorModule === "all" || inspectorModule === mod)
                    .map(([mod, perms]) => {
                      const meta = MODULE_METADATA[mod] ?? {
                        label: mod.toUpperCase(),
                        icon: Layers,
                        description: "Module permissions",
                      };
                      const ModuleIcon = meta.icon;

                      // Filter by search and granted view
                      const visiblePerms = perms.filter((p) => {
                        const isGranted = activeRolePermSet.has(p.key);
                        if (showGrantedOnly && !isGranted) return false;
                        if (!inspectorSearch.trim()) return true;
                        const q = inspectorSearch.toLowerCase();
                        return p.description.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
                      });

                      if (visiblePerms.length === 0) return null;

                      const grantedInModule = perms.filter((p) => activeRolePermSet.has(p.key)).length;

                      return (
                        <Card
                          key={mod}
                          className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs overflow-hidden"
                        >
                          <div className="px-4 py-3 bg-zinc-50/70 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ModuleIcon className="h-4 w-4 text-primary" />
                              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                {meta.label}
                              </h3>
                              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                — {meta.description}
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-[11px] font-semibold">
                              {grantedInModule} of {perms.length} granted
                            </Badge>
                          </div>

                          <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {visiblePerms.map((p) => {
                              const isGranted = activeRolePermSet.has(p.key);
                              return (
                                <div
                                  key={p.key}
                                  className={cn(
                                    "p-3 rounded-xl border flex items-start gap-2.5 transition-colors",
                                    isGranted
                                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40"
                                      : "bg-zinc-50/40 dark:bg-zinc-950/30 border-zinc-200/60 dark:border-zinc-800/60 opacity-60",
                                  )}
                                >
                                  <div className="mt-0.5 shrink-0">
                                    {isGranted ? (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                        <Check className="h-3 w-3 stroke-[3]" />
                                      </div>
                                    ) : (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-muted-foreground">
                                        <XCircle className="h-3 w-3" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <p className="text-xs font-semibold text-foreground leading-snug">
                                        {p.description}
                                      </p>
                                    </div>
                                    <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 text-muted-foreground">
                                      {p.key}
                                    </code>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      );
                    })}
                </div>
              </>
            ) : (
              <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground">Select a role to inspect</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Click on any role in the left list to review its privilege breakdown or create a new role.
                </p>
              </div>
            )}
          </div>
        </div>
      </QueryState>

      {/* ── ROLE BUILDER MODAL (Create & Edit) ──────────────────────────────────── */}
      <Modal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title={builderMode === "create" ? "Create Custom Role" : `Edit Role: ${builderName}`}
        description="Pick a role name and select the exact capabilities from the permission catalog."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* Role Name Field */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Role Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Operations Manager, Attendance Auditor, Team Lead"
              value={builderName}
              onChange={(e) => setBuilderName(e.target.value)}
              className="h-9.5 text-sm bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
            />
          </div>

          {/* Quick Preset Templates */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Quick Starting Presets
            </p>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {ROLE_PRESETS.map((preset) => {
                const PresetIcon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-xs font-medium text-foreground transition-all shrink-0 cursor-pointer shadow-2xs"
                    title={preset.desc}
                  >
                    <PresetIcon className="h-3.5 w-3.5 text-primary" />
                    <span>{preset.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setBuilderSelectedKeys(new Set())}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Search & Module Filter Ribbon */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: "all", label: "All" },
                { id: "admin", label: "Admin" },
                { id: "hr", label: "HR Core" },
                { id: "payroll", label: "Payroll" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBuilderModule(tab.id)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                    builderModule === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-44">
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Filter permissions..."
                  value={builderSearch}
                  onChange={(e) => setBuilderSearch(e.target.value)}
                  className="h-8 pl-7 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-lg"
                />
              </div>
              <Badge variant="secondary" className="text-xs shrink-0 font-medium px-2 py-1">
                {builderSelectedKeys.size} of {catalog.length} selected
              </Badge>
            </div>
          </div>

          {/* Interactive Permission Selector List */}
          <div className="space-y-4 max-h-[46vh] overflow-y-auto pr-1">
            {Array.from(catalogGrouped.entries())
              .filter(([mod]) => builderModule === "all" || builderModule === mod)
              .map(([mod, perms]) => {
                const meta = MODULE_METADATA[mod] ?? { label: mod.toUpperCase(), icon: Layers };
                const ModuleIcon = meta.icon;

                const filteredPerms = perms.filter((p) => {
                  if (!builderSearch.trim()) return true;
                  const q = builderSearch.toLowerCase();
                  return p.description.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
                });

                if (filteredPerms.length === 0) return null;

                const selectedCount = perms.filter((p) => builderSelectedKeys.has(p.key)).length;
                const allSelected = selectedCount === perms.length;

                return (
                  <div
                    key={mod}
                    className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs"
                  >
                    <div className="px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ModuleIcon className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">{meta.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          ({selectedCount}/{perms.length})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleModule(mod)}
                        className="h-6 px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </Button>
                    </div>

                    <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredPerms.map((p) => {
                        const isChecked = builderSelectedKeys.has(p.key);
                        return (
                          <div
                            key={p.key}
                            onClick={() => handleToggleKey(p.key)}
                            className={cn(
                              "p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer select-none",
                              isChecked
                                ? "bg-primary/5 dark:bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                                : "bg-white dark:bg-zinc-900 border-zinc-200/70 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                            )}
                          >
                            <div className="mt-0.5 shrink-0">
                              <div
                                className={cn(
                                  "flex h-4.5 w-4.5 items-center justify-center rounded-md border transition-all",
                                  isChecked
                                    ? "bg-primary border-primary text-primary-foreground shadow-2xs"
                                    : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950",
                                )}
                              >
                                {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground leading-snug">{p.description}</p>
                              <code className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-muted-foreground mt-0.5 inline-block">
                                {p.key}
                              </code>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Modal Actions Footer */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {builderSelectedKeys.size} permission{builderSelectedKeys.size === 1 ? "" : "s"} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBuilderOpen(false)}
                className="h-8.5 text-xs font-medium rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => (builderMode === "create" ? createMutation.mutate() : updateMutation.mutate())}
                disabled={!builderName.trim() || builderSelectedKeys.size === 0 || createMutation.isPending || updateMutation.isPending}
                className="h-8.5 text-xs font-medium rounded-xl gap-1.5 shadow-xs"
              >
                {builderMode === "create" ? (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Role</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
