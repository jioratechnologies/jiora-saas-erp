import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button, Card, Input, PageHeading, QueryState } from "../components/ui";

interface RoleOption {
  id: string;
  name: string;
}
interface UserRow {
  id: string;
  email: string;
  displayName: string;
  zitadelSubjectId: string | null;
  roles: { role: RoleOption }[];
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const usersKey = ["admin", "users"];
  const {
    data: users,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({ queryKey: usersKey, queryFn: () => api.get<UserRow[]>("/admin/users") });
  const { data: roles } = useQuery({ queryKey: ["admin", "roles"], queryFn: () => api.get<RoleOption[]>("/admin/roles") });

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());

  const invite = useMutation({
    mutationFn: () =>
      api.post("/admin/users/invite", { email, displayName, roleIds: Array.from(selectedRoleIds) }),
    onSuccess: () => {
      setEmail("");
      setDisplayName("");
      setSelectedRoleIds(new Set());
      queryClient.invalidateQueries({ queryKey: usersKey });
    },
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });

  return (
    <div className="space-y-6">
      <PageHeading>Users</PageHeading>

      <Card className="max-w-md space-y-3">
        <p className="text-sm font-medium">Invite a user</p>
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Roles</p>
          {roles?.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedRoleIds.has(r.id)}
                onChange={(e) => {
                  const next = new Set(selectedRoleIds);
                  e.target.checked ? next.add(r.id) : next.delete(r.id);
                  setSelectedRoleIds(next);
                }}
              />
              {r.name}
            </label>
          ))}
        </div>
        <Button
          onClick={() => invite.mutate()}
          disabled={!email || !displayName || selectedRoleIds.size === 0 || invite.isPending}
        >
          Send invite
        </Button>
        {invite.isError && <p className="text-sm text-red-600">{(invite.error as Error).message}</p>}
      </Card>

      <Card>
        <QueryState isLoading={usersLoading} error={usersError}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Roles</th>
                <th className="pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="py-2">{u.displayName}</td>
                  <td className="py-2 text-muted-foreground">{u.email}</td>
                  <td className="py-2">{u.roles.map((r) => r.role.name).join(", ")}</td>
                  <td className="py-2">{u.zitadelSubjectId ? "Active" : "Invited"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => deactivate.mutate(u.id)} className="text-xs text-muted-foreground hover:text-red-600">
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
    </div>
  );
}
