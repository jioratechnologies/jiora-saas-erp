import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Clock,
  Globe,
  Copy,
  Check,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldAlert,
  Percent,
  Sliders,
  Sun,
  Laptop,
} from "lucide-react";
import type { Tenant } from "@saas-erp/shared-types";
import { api } from "../api/client";
import { useMe } from "../auth/use-me";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST • UTC+5:30) — India Standard Time" },
  { value: "UTC", label: "UTC (UTC+0:00) — Universal Coordinated Time" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST • UTC+4:00) — Gulf Standard Time" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT • UTC+8:00) — Singapore Time" },
  { value: "Europe/London", label: "Europe/London (GMT/BST • UTC+0/+1) — London" },
  { value: "Europe/Paris", label: "Europe/Paris (CET • UTC+1/+2) — Central Europe" },
  { value: "America/New_York", label: "America/New_York (EST/EDT • UTC-5/-4) — Eastern US" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT • UTC-6/-5) — Central US" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT • UTC-8/-7) — Pacific US" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST • UTC+10/+11) — Sydney" },
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
  timezone: string;
  officeInTime: string;
  officeOutTime: string;
  maxWorkHours: string;
}

type OrgWithSchedule = Tenant & {
  workingDaysPerMonth?: number;
  workHoursPerDay?: number;
  salarySplit?: { basic: number; hra: number; other: number };
  timezone?: string;
  officeInTime?: string;
  officeOutTime?: string;
  maxWorkHours?: number;
};

function toSchedule(org: OrgWithSchedule): WorkSchedule {
  return {
    workingDaysPerMonth: String(org.workingDaysPerMonth ?? 22),
    workHoursPerDay: String(org.workHoursPerDay ?? 8),
    basic: String(org.salarySplit?.basic ?? 50),
    hra: String(org.salarySplit?.hra ?? 25),
    other: String(org.salarySplit?.other ?? 25),
    timezone: org.timezone || "Asia/Kolkata",
    officeInTime: org.officeInTime || "09:30",
    officeOutTime: org.officeOutTime || "18:30",
    maxWorkHours: String(org.maxWorkHours ?? 9),
  };
}

const sameSchedule = (a: WorkSchedule, b: WorkSchedule) =>
  a.workingDaysPerMonth === b.workingDaysPerMonth &&
  a.workHoursPerDay === b.workHoursPerDay &&
  a.basic === b.basic &&
  a.hra === b.hra &&
  a.other === b.other &&
  a.timezone === b.timezone &&
  a.officeInTime === b.officeInTime &&
  a.officeOutTime === b.officeOutTime &&
  a.maxWorkHours === b.maxWorkHours;

function scheduleError(v: WorkSchedule): string | null {
  const days = Number(v.workingDaysPerMonth);
  const hours = Number(v.workHoursPerDay);
  const maxHours = Number(v.maxWorkHours);
  if (v.workingDaysPerMonth.trim() === "" || !Number.isInteger(days) || days < 1 || days > 31) {
    return "Working days must be between 1 and 31.";
  }
  if (v.workHoursPerDay.trim() === "" || !(hours >= 1 && hours <= 24) || Math.round(hours * 2) !== hours * 2) {
    return "Target hours per day must be 1 to 24, in steps of 0.5.";
  }
  if (v.maxWorkHours.trim() === "" || !(maxHours >= hours && maxHours <= 24)) {
    return "Max work hours must be greater than or equal to standard hours (up to 24).";
  }
  const parts = [v.basic, v.hra, v.other].map((x) => (x.trim() === "" ? NaN : Number(x)));
  if (parts.some((n) => !Number.isInteger(n) || n < 0)) return "Salary split percentages must be whole numbers.";
  if (parts[0] + parts[1] + parts[2] !== 100) return "Salary split must add up to exactly 100%.";
  return null;
}

function WorkScheduleSection({ org, canWrite }: { org: OrgWithSchedule; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<WorkSchedule>(() => toSchedule(org));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saved = useRef<WorkSchedule>(toSchedule(org));
  const current = useRef(values);
  current.current = values;
  const inFlight = useRef(false);

  useEffect(() => {
    if (!sameSchedule(saved.current, current.current)) return;
    const next = toSchedule(org);
    saved.current = next;
    setValues(next);
  }, [org]);

  const isDirty = () => !sameSchedule(saved.current, current.current);

  const saveChanges = async () => {
    if (inFlight.current || !canWrite) return;
    const v = current.current;
    const err = scheduleError(v);
    if (err) {
      toast.error("Invalid configuration", err);
      return;
    }
    inFlight.current = true;
    setSaveState("saving");
    try {
      await api.patch<OrgWithSchedule>("/admin/org/work-schedule", {
        workingDaysPerMonth: Number(v.workingDaysPerMonth),
        workHoursPerDay: Number(v.workHoursPerDay),
        salarySplit: { basic: Number(v.basic), hra: Number(v.hra), other: Number(v.other) },
        timezone: v.timezone,
        officeInTime: v.officeInTime,
        officeOutTime: v.officeOutTime,
        maxWorkHours: Number(v.maxWorkHours),
      });
      saved.current = v;
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["org"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Schedule Updated", "Office timings and shift policies saved successfully.");
    } catch (err) {
      setSaveState("error");
      toast.error("Couldn't save changes", formatErrorMessage(err));
    } finally {
      inFlight.current = false;
    }
  };

  const setField = (key: keyof WorkSchedule) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((p) => ({ ...p, [key]: e.target.value }));
  };

  const setPreset = (inTime: string, outTime: string, targetH: string, maxH: string) => {
    setValues((p) => ({
      ...p,
      officeInTime: inTime,
      officeOutTime: outTime,
      workHoursPerDay: targetH,
      maxWorkHours: maxH,
    }));
  };

  const totalSplit = [values.basic, values.hra, values.other].reduce((n, x) => n + (Number(x) || 0), 0);
  const error = scheduleError(values);

  return (
    <Card className="rounded-2xl border-border bg-card shadow-xs">
      <CardContent className="p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Office Timings & Shift Policies</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Define official operating hours, cloud timezone, and max attendance thresholds.
            </p>
          </div>
          <Badge
            variant={error ? "destructive" : saveState === "saved" ? "success" : saveState === "saving" ? "outline" : "secondary"}
            size="sm"
          >
            {error ? "Needs correction" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : isDirty() ? "Unsaved changes" : "Active"}
          </Badge>
        </div>

        {/* Cloud Timezone Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="org-timezone" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-primary" />
              Desired Cloud Timezone
            </Label>
            {values.timezone !== "Asia/Kolkata" && (
              <button
                type="button"
                onClick={() => setValues((p) => ({ ...p, timezone: "Asia/Kolkata" }))}
                className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Reset to IST (India)
              </button>
            )}
          </div>
          <select
            id="org-timezone"
            value={values.timezone}
            disabled={!canWrite}
            onChange={setField("timezone")}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Attendance punches and live clocks operate strictly against this cloud timezone.</span>
          </div>
        </div>

        {/* Office In-Time and Out-Time */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Office Operating Hours
            </Label>
            {/* Quick Shift Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreset("09:30", "18:30", "8", "9")}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                9:30 – 6:30
              </button>
              <button
                type="button"
                onClick={() => setPreset("09:00", "18:00", "8", "9")}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                9:00 – 6:00
              </button>
              <button
                type="button"
                onClick={() => setPreset("10:00", "19:00", "8", "9")}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                10:00 – 7:00
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Office In-Time</span>
              <Input
                type="time"
                value={values.officeInTime}
                disabled={!canWrite}
                onChange={setField("officeInTime")}
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Office Out-Time</span>
              <Input
                type="time"
                value={values.officeOutTime}
                disabled={!canWrite}
                onChange={setField("officeOutTime")}
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Work Hours & Thresholds */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-primary" />
            Shift Durations & Monthly Cycle
          </Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block truncate">Target Hours/Day</span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="1"
                max="24"
                value={values.workHoursPerDay}
                disabled={!canWrite}
                onChange={setField("workHoursPerDay")}
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block truncate">Max Hours/Day</span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="1"
                max="24"
                value={values.maxWorkHours}
                disabled={!canWrite}
                onChange={setField("maxWorkHours")}
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block truncate">Working Days/Mo</span>
              <Input
                type="number"
                step="1"
                min="1"
                max="31"
                value={values.workingDaysPerMonth}
                disabled={!canWrite}
                onChange={setField("workingDaysPerMonth")}
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Salary Component Split (%) */}
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-primary" />
              Standard CTC Salary Split (%)
            </Label>
            <span className={cn("text-xs font-bold font-mono", totalSplit === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
              Total {totalSplit}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Basic (%)</span>
              <Input
                type="number"
                step="1"
                min="0"
                max="100"
                value={values.basic}
                disabled={!canWrite}
                onChange={setField("basic")}
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">HRA (%)</span>
              <Input
                type="number"
                step="1"
                min="0"
                max="100"
                value={values.hra}
                disabled={!canWrite}
                onChange={setField("hra")}
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium block">Other / Special (%)</span>
              <Input
                type="number"
                step="1"
                min="0"
                max="100"
                value={values.other}
                disabled={!canWrite}
                onChange={setField("other")}
                className="h-10 rounded-xl font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        {canWrite && (
          <div className="pt-2">
            <Button
              onClick={saveChanges}
              disabled={inFlight.current || Boolean(error)}
              className="w-full h-10 rounded-xl gap-2 font-bold shadow-md shadow-primary/20"
            >
              {saveState === "saving" ? (
                <span>Saving Schedule…</span>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Timings & Policy</span>
                </>
              )}
            </Button>
          </div>
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
  const [copiedSlug, setCopiedSlug] = useState(false);

  const saved = useRef<Branding | null>(null);
  const current = useRef<Branding>({ primaryColor, logoUrl, showPoweredBy });
  current.current = { primaryColor, logoUrl, showPoweredBy };
  const delayRef = useRef(DEBOUNCE_MS);

  useEffect(() => {
    if (!org) return;
    const s = saved.current;
    const c = current.current;
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

  const flush = useRef(() => {});
  flush.current = () => {
    if (inFlight.current || !canWriteRef.current || !isDirty()) return;
    const seq = ++reqSeq.current;
    const c = current.current;
    if (!HEX_RE.test(c.primaryColor)) return;
    inFlight.current = true;
    setSaveState("saving");
    api
      .patch<Tenant>("/admin/org/theme", {
        primaryColor: c.primaryColor,
        showPoweredBy: c.showPoweredBy,
      })
      .then((res) => {
        if (seq !== reqSeq.current) return;
        saved.current = { primaryColor: res.primaryColor, logoUrl: res.logoUrl ?? "", showPoweredBy: res.showPoweredBy };
        setSaveState("saved");
        queryClient.invalidateQueries({ queryKey: ["org"] });
        inFlight.current = false;
        flush.current();
      })
      .catch((err) => {
        inFlight.current = false;
        setSaveState("error");
        toast.error("Couldn't save branding", formatErrorMessage(err));
      });
  };

  const pickColor = (next: string, immediate = false) => {
    setPrimaryColor(next);
    delayRef.current = immediate ? 0 : DEBOUNCE_MS;
    if (HEX_RE.test(next) && typeof document !== "undefined") {
      applyThemeVariables(document.documentElement, next, themeRef.current === "dark");
    }
  };

  useEffect(() => {
    if (!canWrite || !isDirty() || !HEX_RE.test(primaryColor)) return;
    const t = setTimeout(() => flush.current(), delayRef.current);
    return () => clearTimeout(t);
  }, [primaryColor, showPoweredBy, canWrite]);

  useEffect(() => () => flush.current(), []);

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setLogoFile(file);
    setUploadingLogo(true);
    setLogoError(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.upload<{ logoUrl: string }>("/admin/org/logo", formData);
      setLogoUrl(res.logoUrl);
      if (saved.current) saved.current.logoUrl = res.logoUrl;
      queryClient.invalidateQueries({ queryKey: ["org"] });
      toast.success("Logo uploaded", "Your organisation logo has been updated.");
    } catch (err) {
      toast.error("Upload failed", formatErrorMessage(err));
    } finally {
      setUploadingLogo(false);
      setLogoFile(null);
    }
  };

  const copySlug = () => {
    if (!org?.slug) return;
    navigator.clipboard.writeText(org.slug);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
    toast.success("Copied", "Workspace slug copied to clipboard.");
  };

  const headerStats = useMemo(() => {
    if (!org) return [];
    return [
      { label: "Workspace Name", value: org.name },
      { label: "Workspace Slug", value: org.slug },
      { label: "Operating Timezone", value: org.timezone ? (org.timezone.includes("Kolkata") ? "IST (UTC+5:30)" : org.timezone) : "IST (India)" },
      { label: "Office Shift", value: `${org.officeInTime || "09:30"} – ${org.officeOutTime || "18:30"}` },
      { label: "White-Label", value: showPoweredBy ? "Standard" : "Full White-Label" },
    ];
  }, [org, showPoweredBy]);

  const invalidHex = !HEX_RE.test(primaryColor);
  const status = invalidHex || saveState === "error" ? "Not saved" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : null;

  return (
    <div className="w-full max-w-[1720px] mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      <PageHeader
        title="Organisation & Shift Studio"
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Branding, Logo & Corporate Identity (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Workspace Identity Card */}
              <Card className="rounded-2xl border-border bg-card shadow-xs">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-bold text-foreground">Workspace Profile</h2>
                    </div>
                    <Badge variant="outline" size="sm" className="font-mono">
                      Active Tenant
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Workspace Name</span>
                      <p className="text-sm font-semibold text-foreground">{org.name}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Identifier Slug</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded-md text-foreground">
                          {org.slug}
                        </code>
                        <button
                          type="button"
                          onClick={copySlug}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="Copy slug"
                        >
                          {copiedSlug ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Logo Card */}
              <Card className="rounded-2xl border-border bg-card shadow-xs">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold text-foreground">Logo & Media</h2>
                      <p className="text-xs text-muted-foreground">
                        Your logo appears in the app navigation, login portal, and generated salary vouchers.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    <div className="h-24 w-24 sm:h-20 sm:w-20 shrink-0 rounded-2xl border border-border bg-background p-3 flex items-center justify-center shadow-xs">
                      {logoUrl && !logoError ? (
                        <img
                          src={logoUrl}
                          alt={org.name}
                          className="max-h-full max-w-full object-contain"
                          onError={() => setLogoError(true)}
                        />
                      ) : (
                        <span className="text-lg font-bold text-primary">{org.name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 w-full">
                      <FileDropzone
                        file={logoFile}
                        onFileSelect={handleLogoUpload}
                        accept="image/png,image/jpeg,image/webp"
                        maxSizeBytes={5 * 1024 * 1024}
                        disabled={uploadingLogo || !canWrite}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Theme & Palette Studio */}
              <Card className="rounded-2xl border-border bg-card shadow-xs">
                <CardContent className="p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold text-foreground">Theme & Brand Palette</h2>
                      <p className="text-xs text-muted-foreground">
                        Select a curated enterprise palette or customize your official corporate hex code.
                      </p>
                    </div>
                  </div>

                  {/* Curated Swatches */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Curated Palettes
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
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
                              "h-11 rounded-xl border border-border/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative group",
                              isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 shadow-sm",
                            )}
                            style={{ backgroundColor: palette.hex }}
                          >
                            {isSelected && (
                              <Check className="h-4 w-4 text-white mx-auto drop-shadow-md" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Hex Picker */}
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      id="custom-color-picker"
                      type="color"
                      aria-label="Custom colour"
                      value={HEX_RE.test(primaryColor) ? primaryColor : "#A10C40"}
                      disabled={!canWrite}
                      onChange={(e) => pickColor(e.target.value, false)}
                      className="h-10 w-16 cursor-pointer rounded-xl border border-border bg-background p-1 disabled:opacity-50"
                    />
                    <div className="flex-1 max-w-[180px]">
                      <Input
                        id="custom-hex"
                        aria-label="Hex code"
                        aria-invalid={invalidHex}
                        value={primaryColor}
                        disabled={!canWrite}
                        onChange={(e) => pickColor(e.target.value, false)}
                        className="font-mono text-xs h-10 uppercase rounded-xl"
                      />
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      Adaptive Contrast Active
                    </Badge>
                  </div>

                  {/* White-Label Platform Toggle */}
                  <div className="pt-3 border-t border-border">
                    <label className={cn("flex items-center gap-3 select-none", canWrite ? "cursor-pointer" : "opacity-60")}>
                      <Checkbox
                        checked={showPoweredBy}
                        disabled={!canWrite}
                        onChange={(e) => {
                          delayRef.current = 0;
                          setShowPoweredBy(e.target.checked);
                        }}
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-foreground block">
                          Display "Powered by SaaS ERP" attribution
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          Uncheck for 100% white-labeled enterprise portal experience.
                        </span>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Work Schedule, Shift Hours & Attendance (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <WorkScheduleSection org={org as OrgWithSchedule} canWrite={canWrite} />

              {/* Real-time Experience Simulation */}
              <Card className="rounded-2xl border-primary/20 bg-linear-to-br from-card to-primary/5 shadow-xs overflow-hidden">
                <CardContent className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold text-foreground">Employee Attendance Experience</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Employees punch in against the configured operating window ({org.officeInTime || "09:30"} – {org.officeOutTime || "18:30"}). Daily duration caps at {org.maxWorkHours || 9}h maximum.
                  </p>
                  <div className="p-3 rounded-xl bg-background border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Cloud Sync Engine</span>
                      <Badge variant="success" size="sm" dot>
                        Online
                      </Badge>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Timezone: {org.timezone || "Asia/Kolkata"}
                    </p>
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
