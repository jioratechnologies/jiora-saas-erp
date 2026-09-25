import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { toast } from "../components/ui/toast";

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
      toast.success("Settings saved", "Organisation branding updated successfully.");
    },
    onError: (err) => {
      toast.error("Failed to save settings", (err as Error).message);
    },
  });

  return (
    <div>
      <PageHeader title="Organisation" description="Your workspace's identity and branding." />
      <QueryState
        isLoading={isLoading}
        error={error}
        skeleton={
          <Card className="max-w-lg">
            <CardContent className="space-y-4 pt-5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
            </CardContent>
          </Card>
        }
      >
        {org && (
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <p className="text-sm text-muted-foreground">{org.name}</p>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="primary-color">Primary colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="primary-color-swatch"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-md border border-input bg-background p-0.5"
                  />
                  <Input id="primary-color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="logo-url">Logo URL</Label>
                <Input
                  id="logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showPoweredBy} onChange={(e) => setShowPoweredBy(e.target.checked)} />
                Show "Powered by saas-erp"
              </label>

              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </CardContent>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
