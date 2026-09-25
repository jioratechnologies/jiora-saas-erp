import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { Button, Card, Input, PageHeading, QueryState } from "../components/ui";

export function AdminOrgPage() {
  const queryClient = useQueryClient();
  const {
    data: org,
    isLoading,
    error,
  } = useQuery({ queryKey: ["org", "self"], queryFn: () => api.get<Tenant>("/admin/org") });

  const [primaryColor, setPrimaryColor] = useState("#1F4E78");
  const [logoUrl, setLogoUrl] = useState("");
  const [showPoweredBy, setShowPoweredBy] = useState(true);

  useEffect(() => {
    if (!org) return;
    setPrimaryColor(org.primaryColor);
    setLogoUrl(org.logoUrl ?? "");
    setShowPoweredBy(org.showPoweredBy);
  }, [org]);

  const save = useMutation({
    mutationFn: () => api.patch<Tenant>("/admin/org/theme", { primaryColor, logoUrl, showPoweredBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeading>Organisation</PageHeading>
      <QueryState isLoading={isLoading} error={error}>
        {org && (
          <Card className="max-w-md space-y-3">
            <div>
              <p className="mb-1 text-sm font-medium">Name</p>
              <p className="text-sm text-muted-foreground">{org.name}</p>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Primary colour</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-9 rounded border border-border"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Logo URL</p>
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showPoweredBy} onChange={(e) => setShowPoweredBy(e.target.checked)} />
              Show "Powered by saas-erp"
            </label>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
