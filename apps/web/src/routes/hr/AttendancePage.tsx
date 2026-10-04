import { SearchInput } from "../../components/ui/search-input";
import { fullName } from "../../lib/input-constraints";
import { memo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  MapPin,
  Building,
  Laptop,
  Compass,
  CheckCircle2,
  Calendar,
  LogOut,
  Users,
  Search,
  Download,
  Filter,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { User } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal } from "../../components/ui/modal";
import { toast } from "../../components/ui/toast";
import { formatErrorMessage } from "../../lib/error-formatter";
import { exportToExcel } from "../../lib/excel-export";
import { useMe } from "../../auth/use-me";
import { AttendanceReport } from "../../components/hr/AttendanceReport";
import { Pagination, usePagination } from "../../components/ui/pagination";
import { Skeleton } from "../../components/ui/skeleton";
import { usePagedQuery } from "../../lib/use-paged-query";

interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string | null;
  mode: "OFFICE" | "REMOTE" | "FIELD";
  status: "PRESENT" | "HALF_DAY" | "LATE" | "ABSENT";
  verificationMode?: string;
  verificationStatus?: string;
  syncStatus?: string;
  locationName?: string | null;
  notes?: string | null;
  regularizedBy?: string | null;
  regularizationReason?: string | null;
  person?: {
    id: string;
    firstName: string; middleName?: string | null;
    lastName: string;
    email: string;
    personType?: string;
    department?: { name: string } | null;
    designation?: { name: string } | null;
  };
}

interface RosterItem {
  person: {
    id: string;
    firstName: string; middleName?: string | null;
    lastName: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    personType: "EMPLOYEE" | "VOLUNTEER";
    department?: { id: string; name: string } | null;
    designation?: { id: string; name: string } | null;
  };
  attendance: AttendanceRecord | null;
  onLeave: boolean;
  leaveDetails?: { type: string; code: string; reason: string } | null;
  derivedStatus: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "IN_PROGRESS";
}

/** yyyy-mm-dd from local date components (not UTC). */
function localDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ISO instant for a local date + HH:mm. */
function localIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatDuration(checkIn: string, checkOut?: string | null) {
  if (!checkOut) return "In progress…";
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

const MyLogRow = memo(function MyLogRow({ rec }: { rec: AttendanceRecord }) {
  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">
        {new Date(rec.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </TableCell>
      <TableCell>
        <Badge variant="outline" size="sm">
          {rec.mode}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {new Date(rec.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {rec.checkOutTime
          ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground font-medium">
        {formatDuration(rec.checkInTime, rec.checkOutTime)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {rec.verificationStatus === "FLAGGED" ? (
            <Badge variant="destructive" size="sm" dot>
              Flagged
            </Badge>
          ) : rec.verificationMode === "OFFLINE" ? (
            <Badge variant="secondary" size="sm" dot>
              Offline Synced
            </Badge>
          ) : rec.regularizedBy ? (
            <Badge variant="warning" size="sm" dot>
              Regularized
            </Badge>
          ) : (
            <Badge variant="outline" size="sm" dot>
              Verified
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={
            rec.status === "PRESENT"
              ? "success"
              : rec.status === "HALF_DAY"
              ? "warning"
              : "destructive"
          }
          size="sm"
          dot
        >
          {rec.status.replace("_", " ")}
        </Badge>
      </TableCell>
    </TableRow>
  );
});

const LogSkeletonRows = ({ rows, cols }: { rows: number; cols: number }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: cols }).map((__, j) => (
          <TableCell key={j}>
            <Skeleton className="h-4 w-full max-w-[120px]" />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

export function AttendancePage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canManageAttendance = !!me?.permissionKeys?.includes("hr.attendance.manage");
  const canReadAttendance = !!me?.permissionKeys?.includes("hr.attendance.read");

  // Real-time clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Mode & Check-in form state
  const [selectedMode, setSelectedMode] = useState<"OFFICE" | "REMOTE" | "FIELD">("OFFICE");
  const [checkInNotes, setCheckInNotes] = useState("");
  const [locationName, setLocationName] = useState("");
  const [checkOutNotes, setCheckOutNotes] = useState("");

  // Tab State: "personal" | "team"
  const [activeTab, setActiveTab] = useState<"personal" | "team" | "report">("personal");

  // Filter State for Team View
  const [selectedDate, setSelectedDate] = useState(() => localDateStr(new Date()));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  // Regularize modal state
  const [regularizeModalOpen, setRegularizeModalOpen] = useState(false);
  const [targetRosterItem, setTargetRosterItem] = useState<RosterItem | null>(null);
  const [regStatus, setRegStatus] = useState<"PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE">("PRESENT");
  const [regCheckIn, setRegCheckIn] = useState("09:30");
  const [regCheckOut, setRegCheckOut] = useState("18:00");
  const [regReason, setRegReason] = useState("");

  // Queries
  const { data: todayStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["hr", "attendance", "today"],
    queryFn: () => api.get<AttendanceRecord | null>("/hr/attendance/today"),
  });

  const [logMonth, setLogMonth] = useState(() => localDateStr(new Date()).slice(0, 7));
  const shiftMonth = (delta: number) => {
    const [y, m] = logMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setLogMonth(localDateStr(d).slice(0, 7));
  };
  const myLogs = usePagedQuery<AttendanceRecord>({
    key: ["hr", "attendance", "my-logs"],
    path: "/hr/attendance/my-logs",
    params: { month: logMonth },
    pageSize: 25,
  });
  const myAttendance = myLogs.items;
  const myLogsLoading = myLogs.isLoading;
  const myLogsError = myLogs.error;

  const {
    data: roster,
    isLoading: rosterLoading,
    error: rosterError,
  } = useQuery({
    queryKey: ["hr", "attendance", "roster", selectedDate],
    queryFn: () => api.get<RosterItem[]>(`/hr/attendance/roster?date=${selectedDate}`),
    enabled: activeTab === "team",
  });

  const { data: departments } = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => api.get<Array<{ id: string; name: string }>>("/admin/departments"),
    enabled: activeTab === "team",
  });

  // Mutations
  const checkIn = useMutation({
    mutationFn: () =>
      api.post<AttendanceRecord>("/hr/attendance/check-in", {
        mode: selectedMode,
        locationName: locationName || undefined,
        notes: checkInNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance"] });
      toast.success("Checked in successfully", `Logged at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`);
    },
    onError: (err) => {
      toast.error("Check-in failed", formatErrorMessage(err));
      // 409 = already checked in; refetch so the UI shows the real state.
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance"] });
    },
  });

  const checkOut = useMutation({
    mutationFn: () =>
      api.post<AttendanceRecord>("/hr/attendance/check-out", {
        notes: checkOutNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance"] });
      toast.success("Checked out successfully", "Have a great evening!");
    },
    onError: (err) => {
      toast.error("Check-out failed", formatErrorMessage(err));
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance"] });
    },
  });

  const regularizeMutation = useMutation({
    mutationFn: async () => {
      if (!targetRosterItem) return;
      if (!regReason.trim()) throw new Error("Please provide a reason for attendance regularization.");

      const attendanceId = targetRosterItem.attendance?.id;
      if (attendanceId) {
        return api.post(`/hr/attendance/${attendanceId}/regularize`, {
          status: regStatus,
          checkInTime: localIso(selectedDate, regCheckIn),
          checkOutTime: regStatus === "PRESENT" || regStatus === "HALF_DAY" ? localIso(selectedDate, regCheckOut) : undefined,
          reason: regReason.trim(),
        });
      } else {
        // No record yet: create one for the selected person (not the caller).
        const withTimes = regStatus === "PRESENT" || regStatus === "HALF_DAY";
        return api.post("/hr/attendance/manual", {
          personId: targetRosterItem.person.id,
          date: selectedDate,
          status: regStatus,
          checkInTime: withTimes ? localIso(selectedDate, regCheckIn) : undefined,
          checkOutTime: withTimes && regCheckOut ? localIso(selectedDate, regCheckOut) : undefined,
          reason: regReason.trim(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "attendance"] });
      toast.success("Attendance regularized", `Record updated for ${targetRosterItem?.person.firstName}.`);
      setRegularizeModalOpen(false);
      setRegReason("");
    },
    onError: (err) => {
      toast.error("Regularization failed", formatErrorMessage(err));
    },
  });

  const isCheckedIn = !!todayStatus?.checkInTime;
  const isCheckedOut = !!todayStatus?.checkOutTime;

  // Filtered Roster
  const filteredRoster = roster?.filter((item) => {
    if (departmentFilter !== "ALL" && item.person.department?.id !== departmentFilter) {
      return false;
    }
    if (statusFilter !== "ALL") {
      if (statusFilter === "REMOTE_FIELD") {
        if (!item.attendance || (item.attendance.mode !== "REMOTE" && item.attendance.mode !== "FIELD")) {
          return false;
        }
      } else if (item.derivedStatus !== statusFilter) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = `${fullName(item.person)}`.toLowerCase();
      const email = item.person.email.toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  }) ?? [];

  // Roster pagination
  const rosterPagination = usePagination(filteredRoster, 20);

  // KPI calculations
  const totalStaff = roster?.length || 0;
  const presentCount = roster?.filter((r) => r.derivedStatus === "PRESENT" || r.derivedStatus === "IN_PROGRESS").length || 0;
  const remoteFieldCount = roster?.filter((r) => r.attendance?.mode === "REMOTE" || r.attendance?.mode === "FIELD").length || 0;
  const onLeaveCount = roster?.filter((r) => r.derivedStatus === "ON_LEAVE").length || 0;
  const absentCount = roster?.filter((r) => r.derivedStatus === "ABSENT").length || 0;

  // Excel Export
  const handleExportCsv = async () => {
    if (activeTab === "team" && roster) {
      const headers = [
        "Date",
        "Employee / Volunteer",
        "Type",
        "Department",
        "Designation",
        "Status",
        "Mode",
        "Check-In",
        "Check-Out",
        "Duration",
        "Verification Mode",
        "Verification Status",
        "Notes",
      ];
      const rows = roster.map((r) => [
        selectedDate,
        `${fullName(r.person)}`,
        r.person.personType,
        r.person.department?.name || "—",
        r.person.designation?.name || "—",
        r.derivedStatus,
        r.attendance?.mode || (r.onLeave ? "ON_LEAVE" : "ABSENT"),
        r.attendance?.checkInTime ? new Date(r.attendance.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
        r.attendance?.checkOutTime ? new Date(r.attendance.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
        r.attendance?.checkInTime ? formatDuration(r.attendance.checkInTime, r.attendance.checkOutTime) : "—",
        r.attendance?.verificationMode || "DIRECT",
        r.attendance?.verificationStatus || "VERIFIED",
        r.attendance?.notes || r.leaveDetails?.reason || "",
      ]);
      exportToExcel(`Attendance_Register_${selectedDate}`, headers, rows);
      toast.success("Attendance register exported", `${rows.length} records downloaded.`);
    } else {
      let all: AttendanceRecord[];
      try {
        all = await myLogs.fetchAll();
      } catch (e) {
        toast.error("Export failed", formatErrorMessage(e));
        return;
      }
      const headers = ["Date", "Mode", "Check-In", "Check-Out", "Duration", "Status", "Notes"];
      const rows = all.map((m) => [
        new Date(m.date).toISOString().split("T")[0],
        m.mode,
        new Date(m.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        m.checkOutTime ? new Date(m.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
        formatDuration(m.checkInTime, m.checkOutTime),
        m.status,
        m.notes || "",
      ]);
      exportToExcel(`My_Attendance_Logs_${logMonth}`, headers, rows);
      toast.success("Personal attendance exported", `${rows.length} logs downloaded.`);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6">
      <PageHeader
        icon={Clock}
        title="Attendance Portal"
        description="Real-time punch desk, mobile & remote logging, and team presence tracking."
        badge={
          <Badge variant="outline" className="text-xs font-mono">
            {currentTime.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </Badge>
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-2 font-semibold rounded-xl text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export {activeTab === "team" ? "Register" : "Logs"} (Excel)</span>
          </Button>
        }
      />

      {/* Realtime Hero Attendance Widget */}
      <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-white to-primary/5 dark:from-zinc-900 dark:to-primary/10 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Clock & Status Indicator */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>
                  {currentTime.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="text-4xl font-extrabold tracking-tight text-foreground font-mono">
                {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="flex items-center gap-2 pt-1">
                {statusLoading ? (
                  <Badge variant="outline">Checking status…</Badge>
                ) : isCheckedOut ? (
                  <Badge variant="success" dot>
                    Day Completed ({formatDuration(todayStatus.checkInTime, todayStatus.checkOutTime)})
                  </Badge>
                ) : isCheckedIn ? (
                  <Badge variant="warning" dot>
                    Checked In at {new Date(todayStatus.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ({todayStatus.mode})
                  </Badge>
                ) : (
                  <Badge variant="outline" dot>
                    Not Checked In Yet
                  </Badge>
                )}
              </div>
            </div>

            {/* Check-in / Check-out Interactive Panel */}
            <div className="w-full md:w-auto md:min-w-[340px]">
              {isCheckedOut ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Shift Logged Successfully
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Checked in at {new Date(todayStatus.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Checked out at {new Date(todayStatus.checkOutTime!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ) : isCheckedIn ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Check-out summary / notes (optional)"
                    value={checkOutNotes}
                    onChange={(e) => setCheckOutNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <Button
                    onClick={() => checkOut.mutate()}
                    disabled={checkOut.isPending || statusLoading}
                    variant="destructive"
                    className="w-full gap-2 h-10 font-bold shadow-md shadow-destructive/20"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{checkOut.isPending ? "Logging out…" : "Check Out for the Day"}</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Mode Selector */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    {(
                      [
                        { id: "OFFICE", label: "Office", icon: Building },
                        { id: "REMOTE", label: "Remote", icon: Laptop },
                        { id: "FIELD", label: "Field", icon: Compass },
                      ] as const
                    ).map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedMode(id)}
                        className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          selectedMode === id
                            ? "bg-white dark:bg-zinc-900 text-primary shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>

                  {selectedMode !== "OFFICE" && (
                    <Input
                      placeholder={selectedMode === "FIELD" ? "Field site / area (e.g. Saket Ward 4)" : "Remote location (e.g. Home)"}
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  )}

                  <Button
                    onClick={() => checkIn.mutate()}
                    disabled={checkIn.isPending || statusLoading}
                    className="w-full gap-2 h-10 font-bold shadow-md shadow-primary/25"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{checkIn.isPending ? "Recording…" : `Check In (${selectedMode})`}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === "personal"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>My Attendance Log</span>
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === "team"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Team Overview & Daily Roster</span>
        </button>
        {canReadAttendance && (
          <button
            onClick={() => setActiveTab("report")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === "report"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Attendance Report</span>
          </button>
        )}
      </div>

      {activeTab === "report" && canReadAttendance ? (
        <AttendanceReport />
      ) : activeTab === "personal" ? (
        /* Personal Attendance Logs Table */
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input type="month" value={logMonth} onChange={(e) => e.target.value && setLogMonth(e.target.value)} className="w-40" />
                <Button variant="outline" size="sm" onClick={() => shiftMonth(1)} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {myLogs.isFetching && !myLogsLoading && <span className="text-xs text-muted-foreground">Updating...</span>}
            </div>
            <QueryState isLoading={false} error={myLogsError}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLogsLoading ? (
                    <LogSkeletonRows rows={Math.max(5, Math.min(myLogs.pageSize, 10))} cols={7} />
                  ) : myAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                        No attendance logs for this month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    myAttendance.map((rec) => <MyLogRow key={rec.id} rec={rec} />)
                  )}
                </TableBody>
              </Table>
            </QueryState>
            <Pagination
              currentPage={myLogs.page}
              totalPages={myLogs.totalPages}
              totalItems={myLogs.total}
              pageSize={myLogs.pageSize}
              onPageChange={myLogs.setPage}
              onPageSizeChange={myLogs.setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </CardContent>
        </Card>
      ) : (
        /* Team Overview Roster & KPI Dashboard */
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="p-4 border-zinc-200 dark:border-zinc-800">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Staff</p>
              <p className="text-2xl font-bold font-mono text-foreground mt-1">{totalStaff}</p>
            </Card>
            <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Present</p>
              <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">{presentCount}</p>
            </Card>
            <Card className="p-4 border-blue-500/20 bg-blue-500/5">
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Remote / Field</p>
              <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">{remoteFieldCount}</p>
            </Card>
            <Card className="p-4 border-amber-500/20 bg-amber-500/5">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">On Leave</p>
              <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">{onLeaveCount}</p>
            </Card>
            <Card className="p-4 border-rose-500/20 bg-rose-500/5">
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Unmarked / Absent</p>
              <p className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-300 mt-1">{absentCount}</p>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-36 h-9 text-xs"
              />
              <SearchInput
                placeholder="Search staff…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44"
              />
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                options={[
                  { label: "All Departments", value: "ALL" },
                  ...(departments?.map((d) => ({ label: d.name, value: d.id })) || []),
                ]}
                size="sm"
                className="w-40"
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Present / Active", value: "PRESENT" },
                  { label: "Remote / Field", value: "REMOTE_FIELD" },
                  { label: "On Leave", value: "ON_LEAVE" },
                  { label: "Absent", value: "ABSENT" },
                ]}
                size="sm"
                className="w-36"
              />
            </div>
          </div>

          {/* Roster Table */}
          <Card>
            <CardContent className="p-0">
              <QueryState isLoading={rosterLoading} error={rosterError}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Department / Role</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mode & Location</TableHead>
                      <TableHead>Punch Timestamps</TableHead>
                      <TableHead>Verification</TableHead>
                      {canManageAttendance && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rosterPagination.paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                          No staff found matching the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rosterPagination.paginatedItems.map((item) => (
                        <TableRow key={item.person.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <User
                                name={`${fullName(item.person)}`}
                                description={item.person.email}
                                avatarProps={{ size: "sm", src: item.person.avatarUrl }}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-semibold text-foreground">{item.person.department?.name || "General"}</p>
                              <p className="text-muted-foreground">{item.person.designation?.name || "Staff"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.person.personType === "VOLUNTEER" ? "secondary" : "outline"} size="sm">
                              {item.person.personType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.derivedStatus === "PRESENT"
                                  ? "success"
                                  : item.derivedStatus === "IN_PROGRESS"
                                  ? "warning"
                                  : item.derivedStatus === "ON_LEAVE"
                                  ? "secondary"
                                  : "destructive"
                              }
                              size="sm"
                              dot
                            >
                              {item.derivedStatus === "ON_LEAVE"
                                ? `Leave (${item.leaveDetails?.code || "Approved"})`
                                : item.derivedStatus.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.attendance ? (
                              <div className="text-xs space-y-0.5">
                                <Badge variant="outline" size="sm">
                                  {item.attendance.mode}
                                </Badge>
                                {item.attendance.locationName && (
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                                    {item.attendance.locationName}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {item.attendance?.checkInTime ? (
                              <div>
                                <span>{new Date(item.attendance.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                {item.attendance.checkOutTime && (
                                  <span className="text-muted-foreground"> → {new Date(item.attendance.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.attendance ? (
                              <div className="flex items-center gap-1 text-[11px]">
                                {item.attendance.verificationStatus === "FLAGGED" ? (
                                  <span className="text-rose-500 font-semibold flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Flagged
                                  </span>
                                ) : item.attendance.regularizedBy ? (
                                  <span className="text-amber-500 font-semibold flex items-center gap-1">
                                    <RotateCcw className="h-3 w-3" /> Regularized
                                  </span>
                                ) : item.attendance.verificationMode === "OFFLINE" ? (
                                  <span className="text-zinc-500 font-medium">Offline Sync</span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" /> Verified
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          {canManageAttendance && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTargetRosterItem(item);
                                  setRegStatus(item.attendance ? (item.attendance.status as any) : "PRESENT");
                                  setRegReason("");
                                  setRegularizeModalOpen(true);
                                }}
                                className="h-8 text-xs gap-1.5"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Adjust</span>
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </QueryState>
              <Pagination
                currentPage={rosterPagination.currentPage}
                totalPages={rosterPagination.totalPages}
                totalItems={rosterPagination.totalItems}
                pageSize={rosterPagination.pageSize}
                onPageChange={rosterPagination.setCurrentPage}
                onPageSizeChange={(size) => { rosterPagination.setPageSize(size); rosterPagination.setCurrentPage(1); }}
                pageSizeOptions={[10, 20, 50]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Regularize Modal */}
      <Modal
        isOpen={regularizeModalOpen}
        onClose={() => setRegularizeModalOpen(false)}
        title={`Regularize Attendance: ${fullName(targetRosterItem?.person)}`}
        description={`Manually adjust or confirm attendance record for ${selectedDate}.`}
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Attendance Status</label>
            <Select
              value={regStatus}
              onChange={(e) => setRegStatus(e.target.value as any)}
              options={[
                { label: "Present (Full Day)", value: "PRESENT" },
                { label: "Half Day", value: "HALF_DAY" },
                { label: "Absent", value: "ABSENT" },
                { label: "On Duty / Official Leave", value: "ON_LEAVE" },
              ]}
            />
          </div>

          {(regStatus === "PRESENT" || regStatus === "HALF_DAY") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Check-In Time</label>
                <Input
                  type="time"
                  value={regCheckIn}
                  onChange={(e) => setRegCheckIn(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Check-Out Time</label>
                <Input
                  type="time"
                  value={regCheckOut}
                  onChange={(e) => setRegCheckOut(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Reason for Adjustment / Audit Note <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Field visit biometric device issue / confirmed by Director"
              value={regReason}
              onChange={(e) => setRegReason(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="outline" size="sm" onClick={() => setRegularizeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => regularizeMutation.mutate()}
              disabled={regularizeMutation.isPending || !regReason.trim()}
              className="gap-2 font-bold"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{regularizeMutation.isPending ? "Saving…" : "Save Adjustment"}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
