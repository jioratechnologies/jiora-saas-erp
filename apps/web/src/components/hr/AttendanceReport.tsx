import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { SearchInput } from "../ui/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Modal } from "../ui/modal";
import { QueryState } from "../query-state";
import { Skeleton } from "../ui/skeleton";
import { toast } from "../ui/toast";
import { formatErrorMessage } from "../../lib/error-formatter";
import { exportToExcel } from "../../lib/excel-export";
import { fullName } from "../../lib/input-constraints";

const MAX_DAYS = 92;
const DAY_MS = 86400000;

interface PersonOption {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
}

interface ReportRecord {
  id: string;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  mode: string;
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";
  locationName?: string | null;
  notes?: string | null;
  verificationStatus?: string;
  regularizedBy?: string | null;
  regularizationReason?: string | null;
  person?: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email?: string;
    department?: { name: string } | null;
    designation?: { name: string } | null;
  };
}

/** yyyy-mm-dd from local date components (not UTC). */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

const PRESETS: Array<{ key: string; label: string; range: () => [string, string] }> = [
  { key: "today", label: "Today", range: () => [ymd(new Date()), ymd(new Date())] },
  { key: "5d", label: "Last 5 days", range: () => [ymd(addDays(new Date(), -4)), ymd(new Date())] },
  { key: "7d", label: "Last 7 days", range: () => [ymd(addDays(new Date(), -6)), ymd(new Date())] },
  {
    key: "month",
    label: "This month",
    range: () => {
      const n = new Date();
      return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(n)];
    },
  },
  {
    key: "lastmonth",
    label: "Last month",
    range: () => {
      const n = new Date();
      return [ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1)), ymd(new Date(n.getFullYear(), n.getMonth(), 0))];
    },
  },
];

const dayKey = (iso: string) => iso.slice(0, 10);
const timeStr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

function durationMs(r: ReportRecord): number {
  if (!r.checkInTime || !r.checkOutTime) return 0;
  const ms = new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime();
  return ms > 0 ? ms : 0;
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

const rowDuration = (r: ReportRecord) =>
  r.checkInTime && r.checkOutTime ? fmtDuration(durationMs(r)) : r.checkInTime ? "In progress" : "—";

const statusLabel = (s: string) => s.replace("_", " ");
const statusVariant = (s: string) =>
  s === "PRESENT" ? "success" : s === "HALF_DAY" ? "warning" : s === "ON_LEAVE" ? "secondary" : "destructive";

const ROW_CAP = 500;

const ReportRow = memo(function ReportRow({ r, onSelect }: { r: ReportRecord; onSelect: (r: ReportRecord) => void }) {
  return (
    <TableRow onClick={() => onSelect(r)} className="cursor-pointer">
      <TableCell className="font-medium text-foreground">{fullName(r.person)}</TableCell>
      <TableCell className="text-xs">{dayKey(r.date)}</TableCell>
      <TableCell className="font-mono text-xs">{timeStr(r.checkInTime)}</TableCell>
      <TableCell className="font-mono text-xs">{timeStr(r.checkOutTime)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{rowDuration(r)}</TableCell>
      <TableCell>
        <Badge variant="outline" size="sm">{r.mode}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(r.status)} size="sm" dot>{statusLabel(r.status)}</Badge>
      </TableCell>
      <TableCell className="text-xs max-w-[140px] truncate">{r.locationName || "—"}</TableCell>
      <TableCell className="text-xs max-w-[180px] truncate">{r.notes || "—"}</TableCell>
    </TableRow>
  );
});

export function AttendanceReport() {
  const [personId, setPersonId] = useState<string>("ALL");
  const [comboQuery, setComboQuery] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [from, setFrom] = useState(() => PRESETS[3].range()[0]);
  const [to, setTo] = useState(() => PRESETS[3].range()[1]);
  const [activePreset, setActivePreset] = useState<string | null>("month");
  const [selected, setSelected] = useState<ReportRecord | null>(null);

  const { data: people } = useQuery({
    queryKey: ["hr", "persons", "directory-min"],
    queryFn: () => api.get<PersonOption[]>("/hr/persons"),
  });

  const rangeError = useMemo(() => {
    if (!from || !to) return "Please choose both dates.";
    if (from > to) return "The start date must be on or before the end date.";
    const days = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS) + 1;
    if (days > MAX_DAYS) return `Please choose a date range of ${MAX_DAYS} days or fewer.`;
    return null;
  }, [from, to]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["hr", "attendance", "report", personId, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ startDate: from, endDate: to });
      if (personId !== "ALL") params.set("personId", personId);
      return api.get<ReportRecord[]>(`/hr/attendance?${params.toString()}`);
    },
    enabled: !rangeError,
  });

  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => b.date.localeCompare(a.date) || fullName(a.person).localeCompare(fullName(b.person))),
    [data],
  );

  const summary = useMemo(() => {
    const s = { present: 0, half: 0, absent: 0, leave: 0, ms: 0 };
    for (const r of rows) {
      if (r.status === "PRESENT") s.present++;
      else if (r.status === "HALF_DAY") s.half++;
      else if (r.status === "ABSENT") s.absent++;
      else if (r.status === "ON_LEAVE") s.leave++;
      s.ms += durationMs(r);
    }
    return s;
  }, [rows]);

  const selectedPerson = people?.find((p) => p.id === personId);
  const selectedLabel = personId === "ALL" ? "All employees" : selectedPerson ? fullName(selectedPerson) : "Selected employee";

  const options = useMemo(() => {
    const q = comboQuery.trim().toLowerCase();
    return (people ?? []).filter((p) => !q || `${fullName(p)} ${p.email}`.toLowerCase().includes(q)).slice(0, 50);
  }, [people, comboQuery]);

  const applyPreset = (key: string, range: [string, string]) => {
    setFrom(range[0]);
    setTo(range[1]);
    setActivePreset(key);
  };

  const handleExport = async () => {
    if (!rows.length) return;
    try {
      const headers = ["Employee", "Date", "Check-In", "Check-Out", "Duration", "Mode", "Status", "Location", "Notes"];
      const body = rows.map((r) => [
        fullName(r.person),
        dayKey(r.date),
        timeStr(r.checkInTime),
        timeStr(r.checkOutTime),
        rowDuration(r),
        r.mode,
        statusLabel(r.status),
        r.locationName || "",
        r.notes || "",
      ]);
      const name = (personId === "ALL" ? "All" : selectedLabel).replace(/[^\w-]+/g, "_");
      await exportToExcel(`Attendance_${name}_${from}_${to}`, headers, body);
      toast.success("Attendance report exported", `${body.length} records downloaded.`);
    } catch (err) {
      toast.error("Export failed", formatErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 relative w-full sm:w-64">
            <label className="text-xs font-semibold text-foreground">Employee</label>
            <SearchInput
              placeholder={selectedLabel}
              value={comboQuery}
              onChange={(e) => {
                setComboQuery(e.target.value);
                setComboOpen(true);
              }}
              onFocus={() => setComboOpen(true)}
              onBlur={() => setTimeout(() => setComboOpen(false), 150)}
              onClear={() => setComboQuery("")}
            />
            {comboOpen && (
              <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1 text-xs">
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPersonId("ALL");
                      setComboQuery("");
                      setComboOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 font-semibold hover:bg-muted"
                  >
                    All employees
                  </button>
                </li>
                {options.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPersonId(p.id);
                        setComboQuery("");
                        setComboOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted"
                    >
                      <span className="font-medium">{fullName(p)}</span>
                      <span className="block text-[11px] text-muted-foreground">{p.email}</span>
                    </button>
                  </li>
                ))}
                {options.length === 0 && <li className="px-3 py-2 text-muted-foreground">No matching employees.</li>}
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">From</label>
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset(null);
              }}
              className="w-36 h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">To</label>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset(null);
              }}
              className="w-36 h-9 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!rows.length || !!rangeError}
            className="gap-2 font-semibold rounded-xl text-xs h-9"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key, p.range())}
              className={`px-3 py-1 text-[11px] font-semibold rounded-full border transition-all ${
                activePreset === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground border-border hover:text-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {rangeError && <p className="text-xs font-medium text-destructive">{rangeError}</p>}
      </div>

      <Card>
        <CardContent className="p-0">
          <QueryState
            isLoading={!rangeError && isLoading}
            error={rangeError ? null : error}
            skeleton={
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check-In</TableHead>
                  <TableHead>Check-Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                      No attendance records for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={9} className="text-xs font-semibold">
                        <div className="flex flex-wrap gap-x-5 gap-y-1">
                          <span>Present: <span className="text-emerald-600 dark:text-emerald-400">{summary.present}</span></span>
                          <span>Half day: <span className="text-amber-600 dark:text-amber-400">{summary.half}</span></span>
                          <span>Absent: <span className="text-destructive">{summary.absent}</span></span>
                          <span>Leave: {summary.leave}</span>
                          <span>Total hours: {(summary.ms / 3600000).toFixed(1)}h</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {rows.slice(0, ROW_CAP).map((r) => (
                      <ReportRow key={r.id} r={r} onSelect={setSelected} />
                    ))}
                    {rows.length > ROW_CAP && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-3 text-xs text-muted-foreground">
                          Showing the first {ROW_CAP} of {rows.length} records. Narrow the date range or pick a person to see more.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? fullName(selected.person) : "Attendance details"}
        description={selected ? dayKey(selected.date) : undefined}
      >
        {selected && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 text-xs">
            {[
              ["Email", selected.person?.email || "—"],
              ["Department", selected.person?.department?.name || "—"],
              ["Designation", selected.person?.designation?.name || "—"],
              ["Status", statusLabel(selected.status)],
              ["Mode", selected.mode],
              ["Check-in", timeStr(selected.checkInTime)],
              ["Check-out", timeStr(selected.checkOutTime)],
              ["Duration", rowDuration(selected)],
              ["Location", selected.locationName || "—"],
              ["Verification", selected.verificationStatus || "—"],
              ["Regularized", selected.regularizedBy ? "Yes" : "No"],
              ["Regularization reason", selected.regularizationReason || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground font-semibold">{k}</dt>
                <dd className="text-foreground break-words">{v}</dd>
              </div>
            ))}
            <div className="col-span-2">
              <dt className="text-muted-foreground font-semibold">Notes</dt>
              <dd className="text-foreground break-words">{selected.notes || "—"}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
