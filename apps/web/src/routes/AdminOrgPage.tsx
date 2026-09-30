import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Sparkles,
  Palette,
  Image as ImageIcon,
  Copy,
  Check,
  Globe,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  RefreshCw,
  Eye,
  Sliders,
  Laptop,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { useAuthStore } from "../auth/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { toast } from "../components/ui/toast";
import { FileDropzone } from "../components/ui/file-dropzone";
import { hexToHslTriple, applyThemeVariables } from "../theme/hex-to-hsl";
import { useTheme } from "../theme/ThemeProvider";
import { formatErrorMessage } from "../lib/error-formatter";
import { HeaderActionPortal } from "../components/header-action-portal";
import { cn } from "../lib/utils";

/** Curated designer color palettes for 1-click corporate identity */
const CURATED_PALETTES = [
  { name: "Crimson Saheli", hex: "#A10C40", category: "Warm" },
  { name: "Sapphire Blue", hex: "#1F4E78", category: "Classic" },
  { name: "Deep Indigo", hex: "#4F46E5", category: "Tech" },
  { name: "Royal Purple", hex: "#7C3AED", category: "Modern" },
  { name: "Emerald Forest", hex: "#059669", category: "Growth" },
  { name: "Teal Cyan", hex: "#0D9488", category: "Clean" },
  { name: "Amber Gold", hex: "#D97706", category: "Energetic" },
  { name: "Carbon Slate", hex: "#334155", category: "Minimal" },
];

export function AdminOrgPage() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.user?.access_token);
  const { resolvedTheme } = useTheme();

  const {
    data: org,
    isLoading,
    error,
  } = useQuery({ queryKey: ["org", "self"], queryFn: () => api.get<Tenant>("/admin/org") });

  const [primaryColor, setPrimaryColor] = useState("#A10C40");
  const [logoUrl, setLogoUrl] = useState("");
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewLogoError, setPreviewLogoError] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (!org) return;
    setPrimaryColor(org.primaryColor || "#A10C40");
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
        setPreviewLogoError(false);
        queryClient.invalidateQueries({ queryKey: ["org"] });
        toast.success("Logo uploaded", "Brand logo has been updated and applied system-wide.");
      }
    } catch (err: any) {
      toast.error("Upload failed", formatErrorMessage(err));
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
      toast.success("Settings saved", "Organisation branding and theme updated successfully.");
    },
    onError: (err) => {
      toast.error("Failed to save settings", formatErrorMessage(err));
    },
  });

  const copyToClipboard = (text: string, type: "slug" | "id") => {
    navigator.clipboard.writeText(text);
    if (type === "slug") {
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
    toast.info("Copied to clipboard", text);
  };

  // KPI stats for PageHeader
  const headerStats = useMemo(() => {
    if (!org) return [];
    return [
      { label: "Workspace Name", value: org.name },
      { label: "Workspace Slug", value: org.slug },
      { label: "Brand Color", value: primaryColor.toUpperCase() },
      { label: "White-Label", value: showPoweredBy ? "Standard" : "Full White-Label" },
    ];
  }, [org, primaryColor, showPoweredBy]);

  return (
    <div className="max-w-[1720px] mx-auto space-y-5 px-3 sm:px-6 py-4">
      {/* Header Action Portal for Save button */}
      <HeaderActionPortal>
        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="h-9 gap-1.5 font-medium shadow-xs"
        >
          <Sparkles className="h-4 w-4" />
          <span>{save.isPending ? "Saving..." : "Save Branding"}</span>
        </Button>
      </HeaderActionPortal>

      {/* Modern Sticky Page Header */}
      <PageHeader
        title="Organisation & Branding"
        description="Configure your workspace identity, dynamic color theming, high-resolution logos, and white-label appearance."
        icon={Building2}
        stats={headerStats}
        action={
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="h-9 gap-1.5 font-medium shadow-xs"
          >
            <Sparkles className="h-4 w-4" />
            <span>{save.isPending ? "Saving Changes..." : "Save Changes"}</span>
          </Button>
        }
      />

      <QueryState isLoading={isLoading} error={error}>
        {org && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ── LEFT COLUMN: Configuration Controls (7 cols) ────────────────────── */}
            <div className="lg:col-span-7 space-y-4">
              {/* Workspace Identity Card */}
              <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground">Workspace Profile</CardTitle>
                        <CardDescription className="text-xs">Organization identifiers and tenant metadata.</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-mono px-2 py-0.5 rounded-md">
                      Active Tenant
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Organization Name */}
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/70 dark:border-zinc-800">
                      <Label className="text-xs text-muted-foreground font-medium block mb-1">Company / Organization Name</Label>
                      <p className="text-sm font-bold text-foreground truncate">{org.name}</p>
                    </div>

                    {/* Workspace Slug */}
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <Label className="text-xs text-muted-foreground font-medium block mb-1">Workspace Slug</Label>
                        <code className="text-xs font-mono font-semibold text-primary">{org.slug}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(org.slug, "slug")}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-foreground transition-colors"
                        title="Copy slug"
                      >
                        {copiedSlug ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Tenant ID and Domain Info */}
                  <div className="p-3.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-950/30 border border-zinc-200/60 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Tenant UUID:</span>
                      <code className="text-[11px] font-mono text-foreground truncate max-w-[200px] sm:max-w-xs">{org.id}</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(org.id, "id")}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                    >
                      {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedId ? "Copied" : "Copy ID"}</span>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Logo & Asset Studio Card */}
              <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">Brand Logo & Identity Asset</CardTitle>
                      <CardDescription className="text-xs">
                        High-resolution logo rendered in headers, mobile client, reports, and payslips.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* Current Active Logo Showcase */}
                  {logoUrl && !previewLogoError ? (
                    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                      <div className="h-20 w-20 rounded-2xl border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={logoUrl}
                          alt={org.name}
                          className="max-h-full max-w-full object-contain"
                          onError={() => setPreviewLogoError(true)}
                        />
                      </div>
                      <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
                        <div className="flex items-center justify-center sm:justify-start gap-2">
                          <span className="text-xs font-bold text-foreground">Active Production Logo</span>
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                            Loaded
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Cloud MinIO storage verified. Automatically signs presigned URLs for safe delivery.
                        </p>
                        <a
                          href={logoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 pt-1 font-medium"
                        >
                          <span>Open Full Asset</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/20 text-center space-y-1.5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-lg mx-auto">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-xs font-semibold text-foreground">No custom logo configured</p>
                      <p className="text-[11px] text-muted-foreground">
                        Your workspace currently falls back to brand initials avatar.
                      </p>
                    </div>
                  )}

                  {/* Drag and Drop Uploader */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Upload Replacement Logo</Label>
                    <FileDropzone
                      file={logoFile}
                      onFileSelect={handleLogoUpload}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      maxSizeBytes={5 * 1024 * 1024}
                      disabled={uploadingLogo}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Recommended: High-resolution PNG or SVG with transparent background (square or landscape, max 5MB).
                    </p>
                  </div>

                  {/* Direct URL Accordion */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{showUrlInput ? "Hide direct image URL" : "Or specify direct external image URL"}</span>
                    </button>

                    {showUrlInput && (
                      <div className="mt-2.5 space-y-1">
                        <Input
                          value={logoUrl}
                          onChange={(e) => {
                            setLogoUrl(e.target.value);
                            setPreviewLogoError(false);
                          }}
                          placeholder="https://your-domain.com/logo.png"
                          className="h-9 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Theme Primary Color Card */}
              <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                      <Palette className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">Theme & Brand Color Engine</CardTitle>
                      <CardDescription className="text-xs">
                        Customise button variants, badges, active tabs, and responsive indicators.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* Curated Swatch Presets */}
                  <div>
                    <Label className="text-xs font-semibold text-foreground mb-2 block">
                      Curated Designer Palettes
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CURATED_PALETTES.map((palette) => {
                        const isSelected = primaryColor.toUpperCase() === palette.hex.toUpperCase();
                        return (
                          <button
                            key={palette.hex}
                            type="button"
                            onClick={() => handleColorChange(palette.hex)}
                            className={cn(
                              "p-2 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer text-left select-none",
                              isSelected
                                ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 ring-2 ring-primary shadow-xs"
                                : "bg-zinc-50/70 dark:bg-zinc-950/40 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50",
                            )}
                          >
                            <div
                              className="h-6 w-6 rounded-lg shrink-0 border border-black/10 dark:border-white/10 shadow-2xs"
                              style={{ backgroundColor: palette.hex }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-foreground leading-tight truncate">{palette.name}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{palette.hex}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Custom Hex Picker Input */}
                  <div className="space-y-2">
                    <Label htmlFor="custom-hex" className="text-xs font-semibold text-foreground">
                      Custom Brand Hex Code
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          id="custom-color-picker"
                          type="color"
                          value={primaryColor}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="h-10 w-14 cursor-pointer rounded-xl border border-zinc-300 dark:border-zinc-700 bg-background p-1 shadow-xs"
                        />
                      </div>
                      <div className="relative flex-1 max-w-[160px]">
                        <Input
                          id="custom-hex"
                          value={primaryColor}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="font-mono text-xs h-10 uppercase bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-zinc-100/80 dark:bg-zinc-800/60 px-3 py-2 rounded-xl">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>Live system preview active</span>
                      </div>
                    </div>
                  </div>

                  {/* Adaptive Engine Callout */}
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      Automatic WCAG Contrast Protection
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Our theme engine converts hex colors to HSL and dynamically elevates lightness in dark mode so text, buttons, and focus outlines remain crisp and accessible across both themes.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* White-Labeling Card */}
              <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                <CardContent className="p-5">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <Checkbox
                      checked={showPoweredBy}
                      onChange={(e) => setShowPoweredBy(e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        Display "Powered by SaaS ERP" in footer
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        Uncheck to enable full white-label branding across employee vouchers and login screens.
                      </span>
                    </div>
                  </label>
                </CardContent>
              </Card>

              {/* Bottom Save Action */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">Changes take effect immediately across all client sessions.</span>
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="h-9 px-5 text-xs font-semibold rounded-xl gap-2 shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{save.isPending ? "Saving..." : "Save Branding"}</span>
                </Button>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Live Multi-Surface Brand Preview (5 cols) ─────────── */}
            <div className="lg:col-span-5 space-y-4 sticky top-20">
              <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-bold text-foreground">Live Brand Experience</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-medium bg-primary/10 text-primary border-primary/20">
                      Real-Time Simulation
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    See how your logo and primary color render across the application.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  {/* 1. Simulated Topbar & Brand Header */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Laptop className="h-3 w-3" />
                      App Header & Navigation
                    </span>

                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 shadow-2xs space-y-3">
                      {/* Fake Header Bar */}
                      <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          {logoUrl && !previewLogoError ? (
                            <img src={logoUrl} alt="Logo" className="h-6 w-6 object-contain rounded-md" />
                          ) : (
                            <div className="h-6 w-6 rounded-md bg-primary text-white font-bold text-[10px] flex items-center justify-center">
                              {org.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs font-bold text-foreground truncate max-w-[140px]">{org.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] text-muted-foreground">Admin Portal</span>
                        </div>
                      </div>

                      {/* Fake Sidebar Nav Items */}
                      <div className="space-y-1">
                        <div
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <span className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" />
                            Organisation
                          </span>
                          <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded">Active</span>
                        </div>

                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40">
                          <span className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5" />
                            Departments
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Simulated Component Matrix */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="h-3 w-3" />
                      Buttons & Interactive Controls
                    </span>

                    <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Primary Button */}
                        <button
                          type="button"
                          className="h-8 px-3.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all hover:opacity-90"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Primary Action
                        </button>

                        {/* Soft Tint Button */}
                        <button
                          type="button"
                          className="h-8 px-3 rounded-xl text-xs font-semibold border transition-all"
                          style={{
                            backgroundColor: `${primaryColor}15`,
                            borderColor: `${primaryColor}35`,
                            color: primaryColor,
                          }}
                        >
                          Subtle Variant
                        </button>

                        {/* Outline Button */}
                        <button
                          type="button"
                          className="h-8 px-3 rounded-xl text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          Outline
                        </button>
                      </div>

                      {/* Badge and Indicators */}
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                          style={{
                            backgroundColor: `${primaryColor}15`,
                            borderColor: `${primaryColor}40`,
                            color: primaryColor,
                          }}
                        >
                          Status Active
                        </span>

                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-muted-foreground px-2 py-0.5 rounded-md">
                          Neutral Pill
                        </span>

                        <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: primaryColor }}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Approved</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Simulated Mobile Attendance Punch Widget */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="h-3 w-3" />
                      Mobile Attendance Widget
                    </span>

                    <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">Real-Time Clock Punch</span>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Mobile GPS
                        </Badge>
                      </div>

                      <button
                        type="button"
                        className="w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-xs flex items-center justify-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Check In (09:00 AM)</span>
                      </button>
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
