import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { useMe } from "../auth/use-me";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { toast } from "../components/ui/toast";
import { FileDropzone } from "../components/ui/file-dropzone";
import { applyThemeVariables } from "../theme/hex-to-hsl";
import { useTheme } from "../theme/ThemeProvider";
import { formatErrorMessage } from "../lib/error-formatter";
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

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const DEBOUNCE_MS = 800;

interface Branding {
  primaryColor: string;
  logoUrl: string;
  showPoweredBy: boolean;
}

interface WorkSchedule {
  workingDaysPerMonth: string;
  workHoursPerDay: string;
  basic: string;
  hra: string;
  other: string;
}

type OrgWithSchedule = Tenant & {
  workingDaysPerMonth?: number;
  workHoursPerDay?: number;
  salarySplit?: { basic: number; hra: number; other: number };
};

function toSchedule(org: OrgWithSchedule): WorkSchedule {
  return {
    workingDaysPerMonth: String(org.workingDaysPerMonth ?? 22),
    workHoursPerDay: String(org.workHoursPerDay ?? 8),
    basic: String(org.salarySplit?.basic ?? 50),
    hra: String(org.salarySplit?.hra ?? 25),
    other: String(org.salarySplit?.other ?? 25),
  };
}

const sameSchedule = (a: WorkSchedule, b: WorkSchedule) =>
  a.workingDaysPerMonth === b.workingDaysPerMonth &&
  a.workHoursPerDay === b.workHoursPerDay &&
  a.basic === b.basic &&
  a.hra === b.hra &&
  a.other === b.other;

/** Returns an inline error message, or null when the values can be saved. */
function scheduleError(v: WorkSchedule): string | null {
  const days = Number(v.workingDaysPerMonth);
  const hours = Number(v.workHoursPerDay);
  if (v.workingDaysPerMonth.trim() === "" || !Number.isInteger(days) || days < 1 || days > 31) {
    return "Working days must be between 1 and 31.";
  }
  if (v.workHoursPerDay.trim() === "" || !(hours >= 1 && hours <= 24) || Math.round(hours * 2) !== hours * 2) {
    return "Hours per day must be 1 to 24, in steps of 0.5.";
  }
  const parts = [v.basic, v.hra, v.other].map((x) => (x.trim() === "" ? NaN : Number(x)));
  if (parts.some((n) => !Number.isInteger(n) || n < 0)) return "Split values must be whole numbers.";
  if (parts[0] + parts[1] + parts[2] !== 100) return "Salary split must add up to 100%.";
  return null;
}

function WorkScheduleCard({ org, canWrite }: { org: OrgWithSchedule; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<WorkSchedule>(() => toSchedule(org));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saved = useRef<WorkSchedule>(toSchedule(org));
  const current = useRef(values);
  current.current = values;
  const inFlight = useRef(false);
  const canWriteRef = useRef(canWrite);
  canWriteRef.current = canWrite;

  useEffect(() => {
    // Adopt server values unless local edits are pending.
    if (!sameSchedule(saved.current, current.current)) return;
    const next = toSchedule(org);
    saved.current = next;
    setValues(next);
  }, [org]);

  const isDirty = () => !sameSchedule(saved.current, current.current);

  const flush = useRef(() => {});
  flush.current = () => {
    if (inFlight.current || !canWriteRef.current || !isDirty()) return;
    const v = current.current;
    if (scheduleError(v)) return;
    inFlight.current = true;
    setSaveState("saving");
    api
      .patch<OrgWithSchedule>("/admin/org/work-schedule", {
        workingDaysPerMonth: Number(v.workingDaysPerMonth),
        workHoursPerDay: Number(v.workHoursPerDay),
        salarySplit: { basic: Number(v.basic), hra: Number(v.hra), other: Number(v.other) },
      })
      .then(() => {
        saved.current = v;
        setSaveState("saved");
        queryClient.invalidateQueries({ queryKey: ["org"] });
        inFlight.current = false;
        flush.current();
      })
      .catch((err) => {
        inFlight.current = false;
        setSaveState("error");
        toast.error("Couldn't save changes", formatErrorMessage(err));
      });
  };

  useEffect(() => {
    if (!canWrite || !isDirty() || scheduleError(values)) return;
    const t = setTimeout(() => flush.current(), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [values, canWrite]);

  useEffect(() => () => flush.current(), []);

  const set = (key: keyof WorkSchedule) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((p) => ({ ...p, [key]: e.target.value }));

  const total = [values.basic, values.hra, values.other].reduce((n, x) => n + (Number(x) || 0), 0);
  const error = scheduleError(values);
  const status = error ? "Not saved" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : null;

  const field = (key: keyof WorkSchedule, label: string, step: string, min: string, max?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`ws-${key}`} className="text-xs font-semibold text-foreground">
        {label}
      </Label>
      <Input
        id={`ws-${key}`}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={values[key]}
        disabled={!canWrite}
        onChange={set(key)}
        className="h-10 rounded-xl"
      />
    </div>
  );

  return (
    <Card className="rounded-2xl border-border bg-card shadow-xs">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Work schedule</h2>
          {status && (
            <span role="status" className="text-xs text-muted-foreground">
              {status}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {field("workingDaysPerMonth", "Days per month", "1", "1", "31")}
          {field("workHoursPerDay", "Hours per day", "0.5", "1", "24")}
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-foreground">Salary split (%)</Label>
          <div className="grid grid-cols-3 gap-3 max-w-sm">
            {field("basic", "Basic", "1", "0", "100")}
            {field("hra", "HRA", "1", "0", "100")}
            {field("other", "Other", "1", "0", "100")}
          </div>
          <p className={cn("text-xs", total === 100 ? "text-muted-foreground" : "text-destructive")}>Total {total}%</p>
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminOrgPage() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const { data: me } = useMe();
  const canWrite = Boolean(me?.permissionKeys.includes("admin.org.write"));

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
  const [logoError, setLogoError] = useState(false);

  // Last values known to be on the server; also the "initial load" guard.
  const saved = useRef<Branding | null>(null);
  const current = useRef<Branding>({ primaryColor, logoUrl, showPoweredBy });
  current.current = { primaryColor, logoUrl, showPoweredBy };
  const delayRef = useRef(DEBOUNCE_MS);

  useEffect(() => {
    if (!org) return;
    const s = saved.current;
    const c = current.current;
    // Don't clobber edits that are still waiting to be saved.
    if (s && (s.primaryColor !== c.primaryColor || s.logoUrl !== c.logoUrl || s.showPoweredBy !== c.showPoweredBy)) {
      return;
    }
    const next = { primaryColor: org.primaryColor || "#A10C40", logoUrl: org.logoUrl ?? "", showPoweredBy: org.showPoweredBy };
    saved.current = next;
    setPrimaryColor(next.primaryColor);
    setLogoUrl(next.logoUrl);
    setShowPoweredBy(next.showPoweredBy);
    setLogoError(false);
  }, [org]);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inFlight = useRef(false);
  const reqSeq = useRef(0);
  const canWriteRef = useRef(canWrite);
  canWriteRef.current = canWrite;
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;

  const isDirty = () => {
    const s = saved.current;
    const c = current.current;
    return !!s && (s.primaryColor !== c.primaryColor || s.logoUrl !== c.logoUrl || s.showPoweredBy !== c.showPoweredBy);
  };

  // Serialized save: one PATCH in flight; if values changed meanwhile, save the latest after it settles.
  const flush = useRef(() => {});
  flush.current = () => {
    if (inFlight.current || !canWriteRef.current || !isDirty()) return;
    const values = current.current;
    if (!HEX_RE.test(values.primaryColor)) return;
    inFlight.current = true;
    const id = ++reqSeq.current;
    setSaveState("saving");
    api
      .patch<Tenant>("/admin/org/theme", values)
      .then((data) => {
        if (id === reqSeq.current) saved.current = values; // ignore stale responses
        setSaveState("saved");
        if (typeof window !== "undefined" && data?.primaryColor) {
          applyThemeVariables(document.documentElement, data.primaryColor, themeRef.current === "dark");
          try {
            localStorage.setItem("saas_erp_org_color", data.primaryColor);
          } catch {
            /* storage unavailable */
          }
        }
        queryClient.invalidateQueries({ queryKey: ["org"] });
        inFlight.current = false;
        flush.current(); // values may have changed while pending
      })
      .catch((err) => {
        inFlight.current = false;
        setSaveState("error");
        toast.error("Couldn't save changes", formatErrorMessage(err));
      });
  };

  // Auto-save: debounced for typing/dragging, immediate (delay 0) for discrete picks.
  useEffect(() => {
    if (!saved.current || !canWrite || !isDirty()) return;
    if (!HEX_RE.test(current.current.primaryColor)) return;
    const t = setTimeout(() => flush.current(), delayRef.current);
    return () => clearTimeout(t);
  }, [primaryColor, logoUrl, showPoweredBy, canWrite]);

  // Flush pending edits on unmount; warn on tab close/refresh while unsaved.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (canWriteRef.current && (inFlight.current || isDirty())) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush.current();
    };
  }, []);

  const pickColor = (hex: string, immediate: boolean) => {
    delayRef.current = immediate ? 0 : DEBOUNCE_MS;
    setPrimaryColor(hex);
    if (HEX_RE.test(hex)) {
      applyThemeVariables(document.documentElement, hex, resolvedTheme === "dark");
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    setLogoFile(file);
    if (!file || !canWrite) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await api.upload<{ logoUrl: string }>("/admin/org/logo", formData);
      if (data?.logoUrl) {
        // Upload already persisted the logo; keep saved ref in sync so no redundant PATCH.
        saved.current = { ...current.current, logoUrl: data.logoUrl };
        setLogoUrl(data.logoUrl);
        setLogoError(false);
        queryClient.invalidateQueries({ queryKey: ["org"] });
      }
    } catch (err) {
      toast.error("Upload failed", formatErrorMessage(err));
    } finally {
      setUploadingLogo(false);
      setLogoFile(null);
    }
  };

  const headerStats = useMemo(() => {
    if (!org) return [];
    return [
      { label: "Workspace Name", value: org.name },
      { label: "Workspace Slug", value: org.slug },
      { label: "Brand Color", value: primaryColor.toUpperCase() },
      { label: "White-Label", value: showPoweredBy ? "Standard" : "Full White-Label" },
    ];
  }, [org, primaryColor, showPoweredBy]);

  const invalidHex = !HEX_RE.test(primaryColor);
  const status = invalidHex || saveState === "error" ? "Not saved" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5 px-4 sm:px-6 py-4">
      <PageHeader
        title="Organisation & Branding"
        icon={Building2}
        stats={headerStats}
        badge={
          status ? (
            <span role="status" className="text-xs text-muted-foreground">
              {status}
            </span>
          ) : undefined
        }
      />

      <QueryState isLoading={isLoading} error={error}>
        {org && (
          <Card className="rounded-2xl border-border bg-card shadow-xs">
            <CardContent className="p-5 space-y-6">
              {!canWrite && me && (
                <p className="text-xs text-muted-foreground">You do not have permission to perform this action.</p>
              )}

              {/* Logo */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-xl border border-border bg-background p-2 flex items-center justify-center">
                    {logoUrl && !logoError ? (
                      <img
                        src={logoUrl}
                        alt={org.name}
                        className="max-h-full max-w-full object-contain"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <span className="text-sm font-bold text-primary">{org.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <FileDropzone
                      file={logoFile}
                      onFileSelect={handleLogoUpload}
                      accept="image/png,image/jpeg,image/webp"
                      maxSizeBytes={5 * 1024 * 1024}
                      disabled={uploadingLogo || !canWrite}
                    />
                  </div>
                </div>
              </div>

              {/* Brand colour */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-foreground">Brand colour</Label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {CURATED_PALETTES.map((palette) => {
                    const isSelected = primaryColor.toUpperCase() === palette.hex.toUpperCase();
                    return (
                      <button
                        key={palette.hex}
                        type="button"
                        title={palette.name}
                        aria-label={palette.name}
                        aria-pressed={isSelected}
                        disabled={!canWrite}
                        onClick={() => pickColor(palette.hex, true)}
                        className={cn(
                          "h-10 rounded-xl border border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
                          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        )}
                        style={{ backgroundColor: palette.hex }}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="custom-color-picker"
                    type="color"
                    aria-label="Custom colour"
                    value={HEX_RE.test(primaryColor) ? primaryColor : "#A10C40"}
                    disabled={!canWrite}
                    onChange={(e) => pickColor(e.target.value, false)}
                    className="h-10 w-14 cursor-pointer rounded-xl border border-border bg-background p-1 disabled:opacity-50"
                  />
                  <div>
                    <Input
                      id="custom-hex"
                      aria-label="Hex code"
                      aria-invalid={invalidHex}
                      value={primaryColor}
                      disabled={!canWrite}
                      onChange={(e) => pickColor(e.target.value, false)}
                      className="font-mono text-xs h-10 uppercase max-w-[140px] rounded-xl"
                    />
                    {invalidHex && (
                      <p role="alert" className="mt-1 text-xs text-destructive">
                        Enter a colour like #1F6FEB
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* White-label */}
              <label className={cn("flex items-center gap-3 select-none", canWrite ? "cursor-pointer" : "opacity-60")}>
                <Checkbox
                  checked={showPoweredBy}
                  disabled={!canWrite}
                  onChange={(e) => {
                    delayRef.current = 0;
                    setShowPoweredBy(e.target.checked);
                  }}
                />
                <span className="text-xs font-semibold text-foreground">Show "Powered by SaaS ERP"</span>
              </label>
            </CardContent>
          </Card>
        )}
        {org && <WorkScheduleCard org={org as OrgWithSchedule} canWrite={canWrite} />}
      </QueryState>
    </div>
  );
}
