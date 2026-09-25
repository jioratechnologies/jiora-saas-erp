import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { Button, Card, Input, PageHeading, QueryState } from "../components/ui";

interface RoleRow {
  id: string;
  name: string;
  isProtected: boolean;
  permissions: { permissionKey: string }[];
}

/** The Role Builder: tenant Admin picks permissions from the fixed catalog to build a custom role. */
export function AdminRolesPage() {
  const queryClient = useQueryClient();
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
      setName("");
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: rolesKey });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesKey }),
  });

  const grouped = new Map<string, Permission[]>();
  for (const p of catalog ?? []) {
    grouped.set(p.module, [...(grouped.get(p.module) ?? []), p]);
  }

  return (
    <div className="space-y-6">
      <PageHeading>Roles</PageHeading>

      <Card className="max-w-xl space-y-4">
        <p className="text-sm font-medium">New custom role</p>
        <Input placeholder="Role name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([module, perms]) => (
            <div key={module}>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{module}</p>
              <div className="space-y-1">
                {perms.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
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
        <Button onClick={() => create.mutate()} disabled={!name || selected.size === 0 || create.isPending}>
          Create role
        </Button>
      </Card>

      <Card>
        <QueryState isLoading={rolesLoading} error={rolesError}>
          <ul className="divide-y divide-border text-sm">
            {roles?.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium">{r.name}</span>{" "}
                  {r.isProtected && <span className="text-xs text-muted-foreground">(protected)</span>}
                  <p className="text-xs text-muted-foreground">{r.permissions.length} permissions</p>
                </div>
                {!r.isProtected && (
                  <button onClick={() => remove.mutate(r.id)} className="text-xs text-muted-foreground hover:text-red-600">
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </QueryState>
      </Card>
    </div>
  );
}
