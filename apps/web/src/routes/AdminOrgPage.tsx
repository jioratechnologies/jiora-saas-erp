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
import { hexToHslTriple } from "../theme/hex-to-hsl";
import { formatErrorMessage } from "../lib/error-formatter";
import { Sparkles, Image as ImageIcon } from "lucide-react";

export function AdminOrgPage() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.user?.access_token);
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

  useEffect(() => {
    if (!org) return;
    setPrimaryColor(org.primaryColor);
    setLogoUrl(org.logoUrl ?? "");
    setShowPoweredBy(org.showPoweredBy);
  }, [org]);

  // Live apply primary color to CSS variables for instant visual feedback
  const handleColorChange = (hex: string) => {
    setPrimaryColor(hex);
    if (typeof window !== "undefined" && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      document.documentElement.style.setProperty("--primary", hexToHslTriple(hex));
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
        document.documentElement.style.setProperty("--primary", hexToHslTriple(data.primaryColor));
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
    <div className="space-y-6">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Branding & Theme</CardTitle>
                  <CardDescription>
                    Customise your organisation's theme color and brand logo displayed to all users.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1.5">
                    <Label>Organisation Name</Label>
                    <p className="text-sm font-semibold text-foreground">{org.name}</p>
                    <p className="text-xs text-muted-foreground">Slug: {org.slug}</p>
                  </div>

                  <Separator />

                  {/* Primary Color Picker */}
                  <div className="space-y-2">
                    <Label htmlFor="primary-color">Theme Primary Colour</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="primary-color-swatch"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-xl border border-input bg-background p-0.5 shadow-sm"
                      />
                      <Input
                        id="primary-color"
                        value={primaryColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="font-mono text-xs max-w-[140px]"
                      />
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>Instant preview</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Logo Upload & URL */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Organisation Logo</Label>
                      {uploadingLogo && <span className="text-xs text-primary animate-pulse">Uploading logo…</span>}
                    </div>

                    <FileDropzone
                      file={logoFile}
                      onFileSelect={handleLogoUpload}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      maxSizeBytes={5 * 1024 * 1024}
                      disabled={uploadingLogo}
                    />

                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="logo-url" className="text-xs text-muted-foreground">
                        Or specify direct image URL
                      </Label>
                      <Input
                        id="logo-url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://…"
                      />
                    </div>
                  </div>

                  <Separator />

                  <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                    <Checkbox checked={showPoweredBy} onChange={(e) => setShowPoweredBy(e.target.checked)} />
                    <span className="text-muted-foreground">Show "Powered by saas-erp" in footer</span>
                  </label>

                  <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto">
                    {save.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Live Brand Preview Card */}
            <div>
              <Card className="sticky top-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Brand Preview</CardTitle>
                  <CardDescription className="text-xs">How your team sees your organisation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mock Sidebar Header */}
                  <div className="p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center gap-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={org.name}
                        className="h-9 w-9 rounded-xl object-contain border border-zinc-200/50 bg-white dark:bg-zinc-800"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {org.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate text-foreground">{org.name}</p>
                      <p className="text-[11px] text-muted-foreground">Workspace</p>
                    </div>
                  </div>

                  {/* Mock Button & Badge */}
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground font-medium">Accent Elements:</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Action Button
                      </button>
                      <span
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor: `${primaryColor}20`,
                          color: primaryColor,
                        }}
                      >
                        Active Badge
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

