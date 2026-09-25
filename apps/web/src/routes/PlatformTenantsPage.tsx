import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { Button, Card, Input, PageHeading, QueryState } from "../components/ui";

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
    onSuccess: () => {
      setName("");
      setSlug("");
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
    },
  });

  const toggleSuspend = useMutation({
    mutationFn: (tenant: Tenant) =>
      api.patch<Tenant>(`/platform/tenants/${tenant.id}/${tenant.suspendedAt ? "reinstate" : "suspend"}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] }),
  });

  // A brand-new tenant has zero users — its own /admin/users/invite needs an
  // existing tenant user to call it, which doesn't exist yet. This panel is
  // the bridge: see who's already invited/a member, invite the owner, and
  // cancel a stuck/wrong pending invite — all without touching the DB by hand.
  const [usersOpenFor, setUsersOpenFor] = useState<string | null>(null);
  const usersKey = (tenantId: string) => ["platform", "tenants", tenantId, "users"];
  const { data: tenantUsers } = useQuery({
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
      setOwnerEmail("");
      setOwnerName("");
      queryClient.invalidateQueries({ queryKey: usersKey(tenantId) });
    },
  });

  const cancelInvite = useMutation({
    mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) =>
      api.delete(`/platform/tenants/${tenantId}/users/${userId}/invite`),
    onSuccess: (_data, { tenantId }) => queryClient.invalidateQueries({ queryKey: usersKey(tenantId) }),
  });

  return (
    <div className="space-y-6">
      <PageHeading>Tenants</PageHeading>

      <Card className="max-w-md">
        <p className="mb-3 text-sm font-medium">New tenant</p>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            createTenant.mutate();
          }}
        >
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            placeholder="slug (lowercase-with-hyphens)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
          <Button type="submit" disabled={createTenant.isPending}>
            Create tenant
          </Button>
          {createTenant.isError && <p className="text-sm text-red-600">{(createTenant.error as Error).message}</p>}
        </form>
      </Card>

      <Card>
        <QueryState isLoading={isLoading} error={error}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Slug</th>
                <th className="pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {tenants?.map((t) => (
                <Fragment key={t.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="py-2">{t.name}</td>
                    <td className="py-2 text-muted-foreground">{t.slug}</td>
                    <td className="py-2">{t.suspendedAt ? "Suspended" : "Active"}</td>
                    <td className="py-2 text-right space-x-2">
                      <Button
                        className="bg-muted text-foreground"
                        onClick={() => setUsersOpenFor(usersOpenFor === t.id ? null : t.id)}
                      >
                        Users
                      </Button>
                      <Button className="bg-muted text-foreground" onClick={() => toggleSuspend.mutate(t)}>
                        {t.suspendedAt ? "Reinstate" : "Suspend"}
                      </Button>
                    </td>
                  </tr>
                  {usersOpenFor === t.id && (
                    <tr className="border-b border-border bg-muted/40">
                      <td colSpan={4} className="py-3">
                        {tenantUsers && tenantUsers.length > 0 && (
                          <table className="mb-3 w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-muted-foreground">
                                <th className="pb-1">Email</th>
                                <th className="pb-1">Name</th>
                                <th className="pb-1">Roles</th>
                                <th className="pb-1">Status</th>
                                <th className="pb-1" />
                              </tr>
                            </thead>
                            <tbody>
                              {tenantUsers.map((u) => (
                                <tr key={u.id}>
                                  <td className="py-1">{u.email}</td>
                                  <td className="py-1">{u.displayName}</td>
                                  <td className="py-1">{u.roles.map((r) => r.role.name).join(", ")}</td>
                                  <td className="py-1">{u.zitadelSubjectId ? "Active" : "Invited"}</td>
                                  <td className="py-1 text-right">
                                    {!u.zitadelSubjectId && (
                                      <button
                                        onClick={() => cancelInvite.mutate({ tenantId: t.id, userId: u.id })}
                                        className="text-xs text-muted-foreground hover:text-red-600"
                                      >
                                        Cancel invite
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {tenantUsers?.length === 0 && (
                          <p className="mb-3 text-xs text-muted-foreground">No users yet.</p>
                        )}

                        <form
                          className="flex flex-wrap items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            inviteOwner.mutate(t.id);
                          }}
                        >
                          <div className="w-56">
                            <Input
                              placeholder="New owner email"
                              type="email"
                              value={ownerEmail}
                              onChange={(e) => setOwnerEmail(e.target.value)}
                              required
                            />
                          </div>
                          <div className="w-48">
                            <Input
                              placeholder="Display name"
                              value={ownerName}
                              onChange={(e) => setOwnerName(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" disabled={inviteOwner.isPending}>
                            Invite owner
                          </Button>
                          {inviteOwner.isError && (
                            <span className="text-sm text-red-600">{(inviteOwner.error as Error).message}</span>
                          )}
                        </form>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Invited users claim the "admin" (owner) role automatically the first time they log in with
                          that exact email via Zitadel.
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
    </div>
  );
}
