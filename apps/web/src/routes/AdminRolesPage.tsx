import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Trash2 } from "lucide-react";
import type { Permission } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { useConfirm } from "../hooks/use-confirm";
import { toast } from "../components/ui/toast";

interface RoleRow {
  id: string;
  name: string;
  isProtected: boolean;
  permissions: { permissionKey: string }[];
}

/** The Role Builder: tenant Admin picks permissions from the fixed catalog to build a custom role. */
export function AdminRolesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const rolesKey = ["admin", "roles"];
  const {
    data: roles,
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery({ queryKey: rolesKey, queryFn: () => api.get<RoleRow[]>("/admin/roles") });
  const { data: catalog } = useQuery({
    queryKey: ["admin", "roles", "permission-catalog"],
    queryFn: () => api.get<Permission[]>("/admin/roles/permission-catalog"),
  });

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const create = useMutation({
    mutationFn: () => api.post("/admin/roles", { name, permissionKeys: Array.from(selected) }),
    onSuccess: () => {
      const createdRoleName = name;
      const count = selected.size;
      setName("");
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: rolesKey });
      toast.success("Role created", `"${createdRoleName}" created with ${count} permission${count === 1 ? "" : "s"}.`);
    },
    onError: (err) => {
      toast.error("Failed to create role", (err as Error).message);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKey });
      toast.success("Role deleted", "Custom role deleted successfully.");
    },
    onError: (err) => {
      toast.error("Failed to delete role", (err as Error).message);
    },
  });

  const grouped = new Map<string, Permission[]>();
  for (const p of catalog ?? []) {
    grouped.set(p.module, [...(grouped.get(p.module) ?? []), p]);
  }

  return (
    <div>
      <PageHeader title="Roles" description="Build custom roles from a fixed permission catalog." />

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>New custom role</CardTitle>
            <CardDescription>Pick exactly what this role can see and do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Role name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />

            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([module, perms]) => (
                <div key={module}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{module}</p>
                  <div className="space-y-1.5">
                    {perms.map((p) => (
                      <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected.has(p.key)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            e.target.checked ? next.add(p.key) : next.delete(p.key);
                            setSelected(next);
                          }}
                        />
                        {p.description}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <Button onClick={() => create.mutate()} disabled={!name || selected.size === 0 || create.isPending}>
              Create role
            </Button>
            {create.isError && <p className="text-sm text-destructive">{(create.error as Error).message}</p>}
          </CardContent>
        </Card>

        <Card className="h-fit lg:col-span-2">
          <CardHeader>
            <CardTitle>Existing roles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <QueryState isLoading={rolesLoading} error={rolesError}>
              <ul className="divide-y divide-border">
                {roles?.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{r.name}</span>
                          {r.isProtected && (
                            <Badge variant="secondary" className="text-[10px]">
                              protected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{r.permissions.length} permissions</p>
                      </div>
                    </div>
                    {!r.isProtected && (
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Delete role "${r.name}"?`,
                            description: `Anyone holding this role loses its ${r.permissions.length} permission${r.permissions.length === 1 ? "" : "s"} immediately. This can't be undone.`,
                            confirmLabel: "Delete role",
                          });
                          if (ok) remove.mutate(r.id);
                        }}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Delete role"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </QueryState>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
