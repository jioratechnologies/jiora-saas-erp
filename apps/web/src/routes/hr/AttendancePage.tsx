import { useState, useEffect } from "react";
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
} from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { User } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { toast } from "../../components/ui/toast";

interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string | null;
  mode: "OFFICE" | "REMOTE" | "FIELD";
  status: "PRESENT" | "HALF_DAY" | "LATE" | "ABSENT";
  locationName?: string | null;
  notes?: string | null;
  person?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string } | null;
  };
}

export function AttendancePage() {
  const queryClient = useQueryClient();

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
  const [activeTab, setActiveTab] = useState<"personal" | "team">("personal");

  // Queries
  const { data: todayStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["hr", "attendance", "today"],
    queryFn: () => api.get<AttendanceRecord | null>("/hr/attendance/today"),
  });

  const {
    data: myAttendance,
    isLoading: myLogsLoading,
    error: myLogsError,
  } = useQuery({
    queryKey: ["hr", "attendance", "my-logs"],
    queryFn: () => api.get<AttendanceRecord[]>("/hr/attendance"),
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
      toast.error("Check-in failed", (err as Error).message);
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
      toast.error("Check-out failed", (err as Error).message);
    },
  });

  const formatDuration = (checkIn: string, checkOut?: string | null) => {
    if (!checkOut) return "In progress…";
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const isCheckedIn = !!todayStatus?.checkInTime;
  const isCheckedOut = !!todayStatus?.checkOutTime;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Desk"
        description="Daily check-in/out, remote work logging, and team presence tracking."
      />

      {/* Realtime Hero Attendance Widget */}
      <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-white to-primary/5 dark:from-zinc-900 dark:to-primary/10">
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
                    disabled={checkOut.isPending}
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
                      placeholder={selectedMode === "FIELD" ? "Field site / area (e.g. Ward 4)" : "Remote location (e.g. Home)"}
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  )}

                  <Button
                    onClick={() => checkIn.mutate()}
                    disabled={checkIn.isPending}
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
          <span>Team Overview</span>
        </button>
      </div>

      {/* Attendance Logs Table */}
      <Card>
        <CardContent className="p-0">
          <QueryState isLoading={myLogsLoading} error={myLogsError}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Check-In</TableHead>
                  <TableHead>Check-Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myAttendance?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                      No attendance logs recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  myAttendance?.map((rec) => (
                    <TableRow key={rec.id}>
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
                  ))
                )}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
