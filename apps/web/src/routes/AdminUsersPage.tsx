import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Avatar, User } from "../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { useConfirm } from "../hooks/use-confirm";
import { toast } from "../components/ui/toast";

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
  const confirm = useConfirm();
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
      const invitedEmail = email;
      setEmail("");
      setDisplayName("");
      setSelectedRoleIds(new Set());
      queryClient.invalidateQueries({ queryKey: usersKey });
      toast.success("User invited", `Invitation sent for ${invitedEmail}.`);
    },
    onError: (err) => {
      toast.error("Failed to invite user", (err as Error).message);
    },
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKey });
      toast.success("User deactivated", "The user's access has been disabled.");
    },
    onError: (err) => {
      toast.error("Failed to deactivate user", (err as Error).message);
    },
  });

  return (
    <div>
      <PageHeader title="Users" description="Invite people into your organisation and assign roles." />

      <Card className="mb-5 max-w-lg">
        <CardHeader>
          <CardTitle>Invite a user</CardTitle>
          <CardDescription>They claim this automatically on first login with this email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</p>
            <div className="space-y-1.5">
              {roles?.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
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
          </div>
          <Button
            onClick={() => invite.mutate()}
            disabled={!email || !displayName || selectedRoleIds.size === 0 || invite.isPending}
          >
            Send invite
          </Button>
          {invite.isError && <p className="text-sm text-destructive">{(invite.error as Error).message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <QueryState isLoading={usersLoading} error={usersError}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <User
                        name={u.displayName}
                        description={u.email}
                        avatarProps={{
                          size: "sm",
                          isBordered: true,
                          status: u.zitadelSubjectId ? "online" : undefined,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r.role.name} variant="secondary">
                            {r.role.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.zitadelSubjectId ? "success" : "outline"}>
                        {u.zitadelSubjectId ? "Active" : "Invited"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Deactivate ${u.displayName}?`,
                            description: `${u.email} immediately loses access to this organisation. This can be reversed later by an admin.`,
                            confirmLabel: "Deactivate",
                          });
                          if (ok) deactivate.mutate(u.id);
                        }}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Deactivate"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
