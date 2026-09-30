import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { useAuthStore } from "../auth/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { toast } from "../components/ui/toast";
import { FileDropzone } from "../components/ui/file-dropzone";
import { hexToHslTriple, applyThemeVariables } from "../theme/hex-to-hsl";
import { useTheme } from "../theme/ThemeProvider";
import { formatErrorMessage } from "../lib/error-formatter";
import { Sparkles, Image as ImageIcon } from "lucide-react";

export function AdminOrgPage() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.user?.access_token);
  const { resolvedTheme } = useTheme();
  const {
    data: org,
    isLoading,
    error,
  } = useQuery({ queryKey: ["org", "self"], queryFn: () => api.get<Tenant>("/admin/org") });

  const [primaryColor, setPrimaryColor] = useState("#1F4E78");
  const [logoUrl, setLogoUrl] = useState("");
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewLogoError, setPreviewLogoError] = useState(false);

  useEffect(() => {
    if (!org) return;
    setPrimaryColor(org.primaryColor);
    setLogoUrl(org.logoUrl ?? "");
    setShowPoweredBy(org.showPoweredBy);
    setPreviewLogoError(false);
  }, [org]);

  // Live apply primary color to CSS variables for instant visual feedback
  const handleColorChange = (hex: string) => {
    setPrimaryColor(hex);
    if (typeof window !== "undefined" && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      applyThemeVariables(document.documentElement, hex, resolvedTheme === "dark");
      localStorage.setItem("saas_erp_org_color", hex);
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    setLogoFile(file);
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await api.upload<{ logoUrl: string }>("/admin/org/logo", formData);

      if (data?.logoUrl) {
        setLogoUrl(data.logoUrl);
        queryClient.invalidateQueries({ queryKey: ["org"] });
        toast.success("Logo uploaded", "Organisation logo has been updated and applied system-wide.");
      }
    } catch (err: any) {
      toast.error("Upload failed", err.message || "Failed to upload organisation logo.");
    } finally {
      setUploadingLogo(false);
      setLogoFile(null);
    }
  };

  const save = useMutation({
    mutationFn: () => api.patch<Tenant>("/admin/org/theme", { primaryColor, logoUrl, showPoweredBy }),
    onSuccess: (data) => {
      if (typeof window !== "undefined" && data?.primaryColor) {
        applyThemeVariables(document.documentElement, data.primaryColor, resolvedTheme === "dark");
        localStorage.setItem("saas_erp_org_color", data.primaryColor);
      }
      queryClient.invalidateQueries({ queryKey: ["org"] });
      toast.success("Settings saved", "Organisation branding updated successfully.");
    },
    onError: (err) => {
      toast.error("Failed to save settings", (err as Error).message);
    },
  });

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6">
      <PageHeader title="Organisation" description="Your workspace's identity, branding, and theme." />
      <QueryState
        isLoading={isLoading}
        error={error}
        skeleton={
          <Card className="max-w-xl">
            <CardContent className="space-y-4 pt-5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
            </CardContent>
          </Card>
        }
      >
        {org && (
          <div className="max-w-2xl mx-auto">
            <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-base font-bold">Branding & Theme</CardTitle>
                <CardDescription className="text-xs">
                  Customise your organisation's theme color and brand logo displayed to all users.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Organisation Name</Label>
                    <p className="text-sm font-semibold text-foreground">{org.name}</p>
                  </div>
                  <span className="text-[11px] font-mono bg-zinc-200/60 dark:bg-zinc-700/60 px-2 py-0.5 rounded-md text-muted-foreground">
                    slug: {org.slug}
                  </span>
                </div>

                <Separator />

                {/* Primary Color Picker */}
                <div className="space-y-2">
                  <Label htmlFor="primary-color" className="text-xs font-medium">Theme Primary Colour</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="primary-color-swatch"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-xl border border-input bg-background p-0.5 shadow-sm"
                    />
                    <Input
                      id="primary-color"
                      value={primaryColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="font-mono text-xs max-w-[140px] h-9"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span>Live system preview</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Logo Upload & URL */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Organisation Logo</Label>
                    {uploadingLogo && <span className="text-xs text-primary animate-pulse">Uploading logo…</span>}
                  </div>

                  {logoUrl && !previewLogoError && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800">
                      <img
                        src={logoUrl}
                        alt={org.name}
                        className="h-10 w-10 rounded-lg object-contain border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1"
                        onError={() => setPreviewLogoError(true)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">Current Active Logo</p>
                        <p className="text-[11px] text-muted-foreground truncate">{logoUrl}</p>
                      </div>
                    </div>
                  )}

                  <FileDropzone
                    file={logoFile}
                    onFileSelect={handleLogoUpload}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    maxSizeBytes={5 * 1024 * 1024}
                    disabled={uploadingLogo}
                  />

                  <div className="space-y-1 pt-1">
                    <Label htmlFor="logo-url" className="text-[11px] text-muted-foreground">
                      Or specify direct image URL
                    </Label>
                    <Input
                      id="logo-url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://…"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <Separator />

                <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
                  <Checkbox checked={showPoweredBy} onChange={(e) => setShowPoweredBy(e.target.checked)} />
                  <span className="text-muted-foreground">Show "Powered by saas-erp" in footer</span>
                </label>

                <div className="pt-2">
                  <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto h-9 text-xs font-semibold">
                    {save.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </QueryState>
    </div>
  );
}

