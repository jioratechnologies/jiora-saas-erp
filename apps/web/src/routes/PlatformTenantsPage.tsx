import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, PauseCircle, PlayCircle, UserPlus, X } from "lucide-react";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { User } from "../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { useConfirm } from "../hooks/use-confirm";
import { toast } from "../components/ui/toast";

interface TenantUserRow {
  id: string;
  email: string;
  displayName: string;
  zitadelSubjectId: string | null;
  roles: { role: { name: string } }[];
}

/** Super Admin panel: platform-wide tenant management. Requires platform.tenant.* permissions. */
export function PlatformTenantsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const {
    data: tenants,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["platform", "tenants"],
    queryFn: () => api.get<Tenant[]>("/platform/tenants"),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const createTenant = useMutation({
    mutationFn: () => api.post<Tenant>("/platform/tenants", { name, slug }),
    onSuccess: (tenant) => {
      const createdName = tenant?.name || name;
      setName("");
      setSlug("");
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      toast.success("Tenant created", `"${createdName}" provisioned successfully.`);
    },
    onError: (err) => {
      toast.error("Failed to create tenant", (err as Error).message);
    },
  });

  const toggleSuspend = useMutation({
    mutationFn: (tenant: Tenant) =>
      api.patch<Tenant>(`/platform/tenants/${tenant.id}/${tenant.suspendedAt ? "reinstate" : "suspend"}`),
    onSuccess: (_data, tenant) => {
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      if (tenant.suspendedAt) {
        toast.success("Tenant reinstated", `"${tenant.name}" has been restored to active status.`);
      } else {
        toast.warning("Tenant suspended", `"${tenant.name}" has been locked.`);
      }
    },
    onError: (err) => {
      toast.error("Action failed", (err as Error).message);
    },
  });

  // A brand-new tenant has zero users — its own /admin/users/invite needs an
  // existing tenant user to call it, which doesn't exist yet. This panel is
  // the bridge: see who's already invited/a member, invite the owner, and
  // cancel a stuck/wrong pending invite — all without touching the DB by hand.
  const [usersOpenFor, setUsersOpenFor] = useState<string | null>(null);
  const usersKey = (tenantId: string) => ["platform", "tenants", tenantId, "users"];
  const {
    data: tenantUsers,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: usersOpenFor ? usersKey(usersOpenFor) : ["platform", "tenants", "users", "none"],
    queryFn: () => api.get<TenantUserRow[]>(`/platform/tenants/${usersOpenFor}/users`),
    enabled: Boolean(usersOpenFor),
  });

  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const inviteOwner = useMutation({
    mutationFn: (tenantId: string) =>
      api.post(`/platform/tenants/${tenantId}/invite-owner`, { email: ownerEmail, displayName: ownerName }),
    onSuccess: (_data, tenantId) => {
      const email = ownerEmail;
      setOwnerEmail("");
      setOwnerName("");
      queryClient.invalidateQueries({ queryKey: usersKey(tenantId) });
      toast.success("Owner invited", `Initial invitation dispatched to ${email}.`);
    },
    onError: (err) => {
      toast.error("Failed to invite owner", (err as Error).message);
    },
  });

  const cancelInvite = useMutation({
    mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
      api.delete(`/platform/tenants/${tenantId}/users/${userId}/invite`),
    onSuccess: (_data, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: usersKey(tenantId) });
      toast.info("Invite cancelled", "The invitation has been cancelled.");
    },
    onError: (err) => {
      toast.error("Failed to cancel invite", (err as Error).message);
    },
  });

  return (
    <div>
      <PageHeader title="Tenants" description="Every organisation running on this platform." />

      <Card className="mb-5 max-w-lg">
        <CardHeader>
          <CardTitle>New tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createTenant.mutate();
            }}
          >
            <div className="min-w-[160px] flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="min-w-[160px] flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="lowercase-with-hyphens" required />
            </div>
            <Button type="submit" disabled={createTenant.isPending}>
              Create
            </Button>
          </form>
          {createTenant.isError && (
            <p className="mt-2 text-sm text-destructive">{(createTenant.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <QueryState isLoading={isLoading} error={error}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants?.map((t) => {
                  const isOpen = usersOpenFor === t.id;
                  return (
                    <Fragment key={t.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setUsersOpenFor(isOpen ? null : t.id)}
                      >
                        <TableCell>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                        <TableCell>
                          <Badge variant={t.suspendedAt ? "outline" : "success"}>
                            {t.suspendedAt ? "Suspended" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (!t.suspendedAt) {
                                const ok = await confirm({
                                  title: `Suspend "${t.name}"?`,
                                  description: "Every user in this tenant is locked out immediately. Reinstating brings access back exactly as it was.",
                                  confirmLabel: "Suspend",
                                });
                                if (!ok) return;
                              }
                              toggleSuspend.mutate(t);
                            }}
                            className="gap-1.5"
                          >
                            {t.suspendedAt ? (
                              <PlayCircle className="h-3.5 w-3.5" />
                            ) : (
                              <PauseCircle className="h-3.5 w-3.5" />
                            )}
                            {t.suspendedAt ? "Reinstate" : "Suspend"}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isOpen && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="bg-muted/30 p-4">
                            <QueryState isLoading={usersLoading} error={usersError}>
                              {tenantUsers && tenantUsers.length > 0 && (
                                <div className="mb-3 overflow-hidden rounded-md border border-border bg-background">
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
                                      {tenantUsers.map((u) => (
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
                                          <TableCell>
                                            {!u.zitadelSubjectId && (
                                              <button
                                                onClick={async () => {
                                                  const ok = await confirm({
                                                    title: `Cancel invite for ${u.email}?`,
                                                    description: "They won't be able to claim this invite. You can re-invite them later if needed.",
                                                    confirmLabel: "Cancel invite",
                                                  });
                                                  if (ok) cancelInvite.mutate({ tenantId: t.id, userId: u.id });
                                                }}
                                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                title="Cancel invite"
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                              {tenantUsers?.length === 0 && (
                                <p className="mb-3 text-xs text-muted-foreground">No users yet.</p>
                              )}

                              <form
                                className="flex flex-wrap items-end gap-2"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  inviteOwner.mutate(t.id);
                                }}
                              >
                                <div className="w-56 space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">New owner email</label>
                                  <Input
                                    type="email"
                                    value={ownerEmail}
                                    onChange={(e) => setOwnerEmail(e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="w-48 space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Display name</label>
                                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
                                </div>
                                <Button type="submit" size="sm" disabled={inviteOwner.isPending} className="gap-1.5">
                                  <UserPlus className="h-3.5 w-3.5" />
                                  Invite owner
                                </Button>
                                {inviteOwner.isError && (
                                  <span className="text-sm text-destructive">
                                    {(inviteOwner.error as Error).message}
                                  </span>
                                )}
                              </form>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Invited users claim the "admin" (owner) role automatically the first time they log
                                in with that exact email.
                              </p>
                            </QueryState>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
