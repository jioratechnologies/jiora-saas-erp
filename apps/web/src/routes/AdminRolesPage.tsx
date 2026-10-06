import { SearchInput } from "../components/ui/search-input";
import { useState, useMemo } from "react";
import { useMe } from "../auth/use-me";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Lock,
  Edit3,
  ChevronDown,
  Building2,
  Users,
  WalletCards,
  Check,
  Plus,
  Crown,
  Layers,
  ArrowRight,
} from "lucide-react";
import type { Permission } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { Select } from "../components/ui/select";
import { Modal } from "../components/ui/modal";
import { toast } from "../components/ui/toast";
import { formatErrorMessage } from "../lib/error-formatter";
import { cn } from "../lib/utils";

interface RoleRow {
  id: string;
  name: string;
  isProtected: boolean;
  designationId: string | null;
  permissions: { permissionKey: string }[];
  designation: { id: string; name: string; _count: { persons: number } } | null;
}

type CatalogPermission = Permission & { selfService?: boolean };

/** Visual styling per role kind (protected admin vs designation) */
function getRoleVisuals(isProtected: boolean) {
  if (isProtected) {
    return {
      icon: Crown,
      bgGradient: "from-amber-500/15 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/15",
      textColor: "text-amber-700 dark:text-amber-400",
      borderColor: "border-amber-500/30 dark:border-amber-500/40",
      accentBar: "bg-amber-500",
    };
  }
  return {
    icon: ShieldCheck,
    bgGradient: "from-indigo-500/15 to-primary/10 dark:from-indigo-500/20 dark:to-primary/15",
    textColor: "text-primary dark:text-primary",
    borderColor: "border-primary/30 dark:border-primary/40",
    accentBar: "bg-primary",
  };
}

const MODULE_METADATA: Record<string, { label: string; icon: typeof Building2; description: string }> = {
  admin: {
    label: "Administration",
    icon: Building2,
    description: "Company profile, settings, departments, designations, users, and access",
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


/** Collapsible module card shared by the inspector and the grant/edit modal */
function ModuleCard({
  icon: Icon,
  label,
  description,
  granted,
  total,
  open,
  onToggle,
  action,
  children,
}: {
  icon: typeof Building2;
  label: string;
  description: string;
  granted: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((granted / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 overflow-hidden">
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-1 min-w-0 items-center gap-3 p-3.5 text-left cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", !open && "-rotate-90")}
          />
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground truncate">{label}</span>
              <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                {granted}/{total}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{description}</p>
            <div className="mt-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </button>
        {action}
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-zinc-100 dark:border-zinc-800/80 px-3.5 py-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const MANAGER_KEYS = [
  "hr.person.read",
  "hr.attendance.read",
  "hr.leave.read",
  "hr.leave.approve",
  "payroll.claim.read",
  "payroll.claim.manage",
  "payroll.advance.manage",
];

/** Access Control: per-designation permission editor */
export function AdminRolesPage() {
  const queryClient = useQueryClient();
  const rolesKey = ["admin", "roles"];

  const {
    data: roles = [],
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery({ queryKey: rolesKey, queryFn: () => api.get<RoleRow[]>("/admin/roles") });

  const { data: catalog = [] } = useQuery({
    queryKey: ["admin", "roles", "permission-catalog"],
    queryFn: () => api.get<CatalogPermission[]>("/admin/roles/permission-catalog"),
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  // Manual expand/collapse overrides, keyed `${roleId}:${module}`; absent = default
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  // Modal overrides, keyed by module; reset whenever the modal opens
  const [builderOpenMods, setBuilderOpenMods] = useState<Record<string, boolean>>({});

  // Picker modal: editingRoleId null = "Grant Access" (designation chosen from dropdown)
  const [builderOpen, setBuilderOpen] = useState(false);
  const { data: me } = useMe();
  const canWriteRoles = Boolean(me?.permissionKeys?.includes("admin.role.write"));
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [builderRoleId, setBuilderRoleId] = useState("");
  const [builderSelectedKeys, setBuilderSelectedKeys] = useState<Set<string>>(new Set());

  const selfServiceKeys = useMemo(() => new Set(catalog.filter((p) => p.selfService).map((p) => p.key)), [catalog]);
  const editableKeys = useMemo(() => catalog.filter((p) => !selfServiceKeys.has(p.key)).map((p) => p.key), [catalog, selfServiceKeys]);

  const extraCount = (role: RoleRow) => role.permissions.filter((p) => !selfServiceKeys.has(p.permissionKey)).length;
  const displayName = (role: RoleRow) => role.designation?.name ?? role.name;

  // Admin first, then designations alphabetically
  const sortedRoles = useMemo(
    () =>
      [...roles].sort((a, b) => {
        if (a.isProtected !== b.isProtected) return a.isProtected ? -1 : 1;
        return (a.designation?.name ?? a.name).localeCompare(b.designation?.name ?? b.name);
      }),
    [roles],
  );

  const activeRole = useMemo(() => {
    if (sortedRoles.length === 0) return null;
    return sortedRoles.find((r) => r.id === selectedRoleId) ?? sortedRoles[0];
  }, [sortedRoles, selectedRoleId]);

  const catalogGrouped = useMemo(() => {
    const map = new Map<string, CatalogPermission[]>();
    for (const p of catalog) map.set(p.module, [...(map.get(p.module) ?? []), p]);
    return map;
  }, [catalog]);

  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return sortedRoles;
    const q = roleSearch.toLowerCase();
    return sortedRoles.filter((r) => displayName(r).toLowerCase().includes(q));
  }, [sortedRoles, roleSearch]);

  // Designations with no extra (non-self-service) access yet
  const grantable = useMemo(
    () => sortedRoles.filter((r) => !r.isProtected && r.designationId && extraCount(r) === 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedRoles, selfServiceKeys],
  );

  const activeRolePermSet = useMemo(() => {
    const set = new Set<string>(selfServiceKeys);
    if (activeRole) for (const p of activeRole.permissions) set.add(p.permissionKey);
    return set;
  }, [activeRole, selfServiceKeys]);

  const targetRoleId = editingRoleId ?? builderRoleId;
  const targetRole = roles.find((r) => r.id === targetRoleId) ?? null;

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch<RoleRow>(`/admin/roles/${targetRoleId}`, {
        permissionKeys: Array.from(builderSelectedKeys).filter((k) => !selfServiceKeys.has(k)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKey });
      if (targetRoleId) setSelectedRoleId(targetRoleId);
      setBuilderOpen(false);
      toast.success("Access saved", `Access for "${targetRole ? displayName(targetRole) : "designation"}" was saved.`);
    },
    onError: (err) => {
      toast.error("Failed to save access", formatErrorMessage(err));
    },
  });

  const handleOpenGrant = () => {
    setEditingRoleId(null);
    setBuilderRoleId("");
    setBuilderSelectedKeys(new Set());
    setBuilderOpenMods({});
    setBuilderOpen(true);
  };

  const handleOpenEdit = (role: RoleRow) => {
    if (role.isProtected || !role.designationId) return;
    setEditingRoleId(role.id);
    setBuilderRoleId(role.id);
    setBuilderSelectedKeys(new Set(role.permissions.map((p) => p.permissionKey).filter((k) => !selfServiceKeys.has(k))));
    setBuilderOpenMods({});
    setBuilderOpen(true);
  };

  const handleToggleKey = (key: string) => {
    if (selfServiceKeys.has(key)) return;
    const next = new Set(builderSelectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setBuilderSelectedKeys(next);
  };

  const handleToggleModule = (module: string) => {
    const modulePerms = catalog.filter((p) => p.module === module && !selfServiceKeys.has(p.key));
    const allSelected = modulePerms.every((p) => builderSelectedKeys.has(p.key));
    const next = new Set(builderSelectedKeys);
    for (const p of modulePerms) {
      if (allSelected) next.delete(p.key);
      else next.add(p.key);
    }
    setBuilderSelectedKeys(next);
  };

  const presets = useMemo(() => {
    const byModule = (m: string) => editableKeys.filter((k) => k.startsWith(`${m}.`));
    const valid = new Set(editableKeys);
    return [
      { id: "hr", label: "HR", keys: byModule("hr") },
      { id: "payroll", label: "Payroll", keys: byModule("payroll") },
      { id: "manager", label: "Manager approvals", keys: MANAGER_KEYS.filter((k) => valid.has(k)) },
      { id: "full", label: "Full access", keys: editableKeys },
    ].filter((p) => p.keys.length > 0);
  }, [editableKeys]);

  const applyPreset = (keys: string[]) => setBuilderSelectedKeys(new Set(keys));

  const headerStats = useMemo(
    () => [
      { label: "Designations", value: roles.filter((r) => !r.isProtected && r.designationId).length },
      { label: "Organisation Admin", value: roles.filter((r) => r.isProtected).length },
      { label: "Permission Catalog", value: catalog.length },
    ],
    [roles, catalog],
  );

  const canSave = !!targetRoleId && !saveMutation.isPending;

  return (
    <div className="max-w-[1720px] mx-auto space-y-5 px-4 sm:px-6 py-4">
      <PageHeader
        title="Access Control"
        description="Choose what each designation can do. Everyone also gets self-service access."
        icon={ShieldCheck}
        stats={headerStats}
        action={
          canWriteRoles ? (
            <Button onClick={handleOpenGrant} disabled={roles.length === 0} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Grant Access
            </Button>
          ) : undefined
        }
      />

      <QueryState isLoading={rolesLoading} error={rolesError}>
        {roles.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground">Create designations on the Designations page</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Access is managed per designation. Add one to start assigning permissions.
            </p>
            <Link
              to="/admin/designations"
              className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-primary hover:underline"
            >
              Go to Designations
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT PANE */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Designations</h2>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                  {roles.length}
                </Badge>
              </div>
              <SearchInput
                placeholder="Search designations..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                className=""
              />

              <div className="space-y-2.5 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
                {filteredRoles.map((role) => {
                  const isSelected = activeRole?.id === role.id;
                  const visuals = getRoleVisuals(role.isProtected);
                  const IconComponent = visuals.icon;
                  const extra = extraCount(role);
                  const people = role.designation?._count.persons ?? 0;
                  const nonSelfTotal = Math.max(editableKeys.length, 1);
                  const percentage = Math.round((extra / nonSelfTotal) * 100);

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
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br border",
                            visuals.bgGradient,
                            visuals.borderColor,
                            visuals.textColor,
                          )}
                        >
                          <IconComponent className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-foreground truncate">{displayName(role)}</span>
                            {role.isProtected ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 rounded-md"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                Protected
                              </Badge>
                            ) : extra === 0 ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 font-normal bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-zinc-200 dark:border-zinc-700 rounded-md"
                              >
                                No access set
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {role.isProtected
                              ? "Full access"
                              : `${people} ${people === 1 ? "person" : "people"} · ${extra} access`}
                          </p>
                        </div>
                      </div>

                      {!role.isProtected && (
                        <div className="mt-3 w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-300", visuals.accentBar)}
                            style={{ width: extra === 0 ? "0%" : `${Math.max(percentage, 4)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredRoles.length === 0 && (
                  <div className="py-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <ShieldAlert className="h-7 w-7 text-muted-foreground/60 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">No matching designations</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Try searching with a different term.</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANE */}
            <div className="lg:col-span-8 space-y-4">
              {activeRole ? (
                <>
                  {(() => {
                    const visuals = getRoleVisuals(activeRole.isProtected);
                    const IconComponent = visuals.icon;
                    const modEntries = Array.from(catalogGrouped.entries());
                    const isOpen = (mod: string, perms: CatalogPermission[]) =>
                      openOverrides[`${activeRole.id}:${mod}`] ??
                      perms.some((p) => !p.selfService && activeRolePermSet.has(p.key));
                    const allOpen = modEntries.length > 0 && modEntries.every(([m, ps]) => isOpen(m, ps));
                    const setAll = (v: boolean) =>
                      setOpenOverrides((prev) => {
                        const next = { ...prev };
                        for (const [m] of modEntries) next[`${activeRole.id}:${m}`] = v;
                        return next;
                      });

                    return (
                      <>
                        <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-0">
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
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h2 className="text-lg font-bold text-foreground tracking-tight">{displayName(activeRole)}</h2>
                                  {activeRole.isProtected && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1.5 rounded-lg"
                                    >
                                      <Lock className="h-3 w-3" />
                                      Read-only
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Granted {activeRolePermSet.size} of {catalog.length}
                                </p>
                              </div>
                            </div>

                            {canWriteRoles && !activeRole.isProtected && activeRole.designationId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(activeRole)}
                                className="h-8 gap-1.5 text-xs font-medium rounded-xl border-zinc-200 dark:border-zinc-800 self-start sm:self-auto"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit access
                              </Button>
                            )}
                          </div>
                        </Card>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setAll(!allOpen)}
                            className="text-xs font-medium text-primary hover:underline cursor-pointer"
                          >
                            {allOpen ? "Collapse all" : "Expand all"}
                          </button>
                        </div>

                        <div className="space-y-3">
                          {modEntries.map(([mod, perms]) => {
                            const meta = MODULE_METADATA[mod] ?? { label: mod.toUpperCase(), icon: Layers, description: "Module permissions" };
                            const grantedInModule = perms.filter((p) => activeRolePermSet.has(p.key)).length;
                            return (
                              <ModuleCard
                                key={mod}
                                icon={meta.icon}
                                label={meta.label}
                                description={meta.description}
                                granted={grantedInModule}
                                total={perms.length}
                                open={isOpen(mod, perms)}
                                onToggle={() =>
                                  setOpenOverrides((prev) => ({ ...prev, [`${activeRole.id}:${mod}`]: !isOpen(mod, perms) }))
                                }
                              >
                                {perms.map((p) => {
                                  const isGranted = activeRolePermSet.has(p.key);
                                  return (
                                    <div key={p.key} className="flex items-center gap-2.5 py-2">
                                      {isGranted ? (
                                        <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                                          <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                      ) : (
                                        <div className="h-4.5 w-4.5 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700" />
                                      )}
                                      <p
                                        className={cn(
                                          "flex-1 min-w-0 text-xs leading-snug",
                                          isGranted ? "text-foreground font-medium" : "text-muted-foreground",
                                        )}
                                      >
                                        {p.description}
                                      </p>
                                      {p.selfService && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md shrink-0">
                                          Everyone
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })}
                              </ModuleCard>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-foreground">Select a designation to inspect</h3>
                </div>
              )}
            </div>
          </div>
        )}
      </QueryState>

      {/* ── ACCESS PICKER MODAL (grant + edit) ── */}
      <Modal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title={editingRoleId && targetRole ? `Edit access: ${displayName(targetRole)}` : "Grant Access"}
        description="Select what everyone holding this designation can do. Self-service access is always included."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {!editingRoleId && (
            <div className="space-y-1.5">
              <Select
                label="Designation"
                placeholder="Choose a designation"
                value={builderRoleId}
                onChange={(e) => setBuilderRoleId(e.target.value)}
                options={grantable.map((r) => ({
                  value: r.id,
                  label: displayName(r),
                  description: `${r.designation?._count.persons ?? 0} people`,
                }))}
                disabled={grantable.length === 0}
              />
              {grantable.length === 0 && (
                <p className="text-xs text-muted-foreground">Every designation already has access set. Edit one from the list.</p>
              )}
            </div>
          )}

          {(editingRoleId || grantable.length > 0) && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Quick pick</span>
                {presets.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => applyPreset(pr.keys)}
                    className="px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    {pr.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBuilderSelectedKeys(new Set())}
                  className="px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                {Array.from(catalogGrouped.entries()).map(([mod, perms]) => {
                  const meta = MODULE_METADATA[mod] ?? { label: mod.toUpperCase(), icon: Layers, description: "Module permissions" };
                  const editable = perms.filter((p) => !selfServiceKeys.has(p.key));
                  const selectedCount = editable.filter((p) => builderSelectedKeys.has(p.key)).length;
                  const allSelected = editable.length > 0 && selectedCount === editable.length;
                  const open = builderOpenMods[mod] ?? selectedCount > 0;

                  return (
                    <ModuleCard
                      key={mod}
                      icon={meta.icon}
                      label={meta.label}
                      description={meta.description}
                      granted={selectedCount}
                      total={editable.length}
                      open={open}
                      onToggle={() => setBuilderOpenMods((prev) => ({ ...prev, [mod]: !open }))}
                      action={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleModule(mod)}
                          disabled={editable.length === 0}
                          className="h-6 px-2 text-[11px] font-medium text-primary hover:bg-primary/10 shrink-0"
                        >
                          {allSelected ? "Deselect all" : "Select all"}
                        </Button>
                      }
                    >
                      {perms.map((p) => {
                        const isEveryone = selfServiceKeys.has(p.key);
                        const isChecked = isEveryone || builderSelectedKeys.has(p.key);
                        return (
                          <div
                            key={p.key}
                            role="checkbox"
                            aria-checked={isChecked}
                            aria-disabled={isEveryone}
                            tabIndex={isEveryone ? -1 : 0}
                            onClick={() => handleToggleKey(p.key)}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                handleToggleKey(p.key);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2.5 py-2 select-none",
                              isEveryone ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-all",
                                isChecked
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950",
                              )}
                            >
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <p className="flex-1 min-w-0 text-xs text-foreground leading-snug">{p.description}</p>
                            {isEveryone && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md shrink-0">
                                Everyone
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </ModuleCard>
                  );
                })}
              </div>
            </>
          )}

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {builderSelectedKeys.size} of {editableKeys.length} selected
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setBuilderOpen(false)} className="h-8.5 text-xs font-medium rounded-xl">
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!canSave}
                className="h-8.5 text-xs font-medium rounded-xl gap-1.5 shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save</span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
