import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Calendar, Star } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { DatePicker } from "../../components/ui/date-picker";
import { DateInput } from "../../components/ui/date-input";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal } from "../../components/ui/modal";
import { HeaderActionPortal } from "../../components/header-action-portal";
import { useConfirm } from "../../hooks/use-confirm";
import { toast } from "../../components/ui/toast";
import { useMe } from "../../auth/use-me";
import { formatErrorMessage } from "../../lib/error-formatter";

interface Holiday {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
}

export function HolidaysPage({ embedded = false }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: me } = useMe();

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isOptional, setIsOptional] = useState(false);

  // Queries
  const {
    data: holidays,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["hr", "holidays", selectedYear],
    queryFn: () => api.get<Holiday[]>(`/hr/holidays?year=${selectedYear}`),
  });

  // Mutations
  const createHoliday = useMutation({
    mutationFn: () =>
      api.post<Holiday>("/hr/holidays", {
        name,
        date: new Date(date).toISOString(),
        isOptional,
      }),
    onSuccess: (h) => {
      setCreateModalOpen(false);
      setName("");
      setDate("");
      setIsOptional(false);
      queryClient.invalidateQueries({ queryKey: ["hr", "holidays"] });
      toast.success("Holiday added", `"${h.name}" added to the ${selectedYear} calendar.`);
    },
    onError: (err) => {
      toast.error("Failed to add holiday", formatErrorMessage(err));
    },
  });

  const deleteHoliday = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "holidays"] });
      toast.success("Holiday deleted", "Removed from annual calendar.");
    },
    onError: (err) => {
      toast.error("Failed to delete holiday", formatErrorMessage(err));
    },
  });

  const canWrite = me?.permissionKeys?.includes("hr.holiday.write");

  const mandatoryCount = (holidays || []).filter((h) => !h.isOptional).length;
  const optionalCount = (holidays || []).filter((h) => h.isOptional).length;

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6">
      {canWrite && !embedded && (
        <HeaderActionPortal>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="h-9 gap-1.5 font-medium shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Holiday</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </HeaderActionPortal>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              Holiday Calendar
            </h2>
            <p className="text-xs text-muted-foreground">
              {holidays?.length || 0} holidays in {selectedYear} ({mandatoryCount} mandatory, {optionalCount} optional)
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Year Selector */}
            <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200/80 dark:border-zinc-800">
              {[2025, 2026, 2027].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    selectedYear === yr
                      ? "bg-white dark:bg-zinc-900 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            {canWrite && (
              <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shrink-0 rounded-xl text-xs font-bold shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Holiday</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {!embedded && (
      <PageHeader
        icon={CalendarDays}
        title="Holiday Calendar"
        description="Annual paid holidays, national observances, and optional festival leaves."
        badge={
          <Badge variant="outline" className="text-xs font-mono">
            {holidays?.length || 0} Holidays in {selectedYear}
          </Badge>
        }
        action={
          <div className="flex items-center gap-2.5">
            {/* Year Selector */}
            <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200/80 dark:border-zinc-800">
              {[2025, 2026, 2027].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    selectedYear === yr
                      ? "bg-white dark:bg-zinc-900 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            {canWrite && (
              <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shrink-0 rounded-xl text-xs font-bold shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Holiday</span>
              </Button>
            )}
          </div>
        }
        stats={[
          { label: `Total (${selectedYear})`, value: `${holidays?.length || 0} Days` },
          { label: "Mandatory", value: `${mandatoryCount} Days`, color: "text-emerald-500" },
          { label: "Optional", value: `${optionalCount} Days`, color: "text-amber-500" },
        ]}
      />
      )}

      {/* Holidays Table and Cards */}
      <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <QueryState isLoading={isLoading} error={error}>
            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40">
                    <TableHead className="w-44 font-semibold text-xs">Date</TableHead>
                    <TableHead className="font-semibold text-xs">Holiday Observance</TableHead>
                    <TableHead className="font-semibold text-xs">Day of Week</TableHead>
                    <TableHead className="font-semibold text-xs">Classification</TableHead>
                    {canWrite && <TableHead className="w-16 text-right pr-4 font-semibold text-xs">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                        No holidays configured for the year {selectedYear}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    holidays?.map((h) => {
                      const holidayDate = new Date(h.date);
                      return (
                        <TableRow key={h.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                          <TableCell className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                                <span className="text-[10px] font-bold uppercase leading-none">
                                  {holidayDate.toLocaleDateString(undefined, { month: "short" })}
                                </span>
                                <span className="text-sm font-extrabold leading-tight">
                                  {holidayDate.getDate()}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-foreground">
                                {holidayDate.toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 font-semibold text-foreground text-sm">
                            {h.name}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-xs text-muted-foreground font-medium">
                            {holidayDate.toLocaleDateString(undefined, { weekday: "long" })}
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <Badge
                              variant={h.isOptional ? "warning" : "success"}
                              size="sm"
                              dot
                            >
                              {h.isOptional ? "Optional / Restricted" : "Mandatory / Public"}
                            </Badge>
                          </TableCell>
                          {canWrite && (
                            <TableCell className="py-3 px-4 text-right">
                              <button
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Delete ${h.name}?`,
                                    description: `Are you sure you want to remove ${h.name} from the ${selectedYear} calendar?`,
                                    confirmLabel: "Delete",
                                  });
                                  if (ok) deleteHoliday.mutate(h.id);
                                }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Delete holiday"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {holidays?.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No holidays configured for {selectedYear}.
                </div>
              ) : (
                holidays?.map((h) => {
                  const holidayDate = new Date(h.date);
                  return (
                    <div key={h.id} className="p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                          <span className="text-[10px] font-bold uppercase leading-none">
                            {holidayDate.toLocaleDateString(undefined, { month: "short" })}
                          </span>
                          <span className="text-sm font-extrabold leading-tight">
                            {holidayDate.getDate()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">{h.name}</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {holidayDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={h.isOptional ? "warning" : "success"} size="sm" dot>
                          {h.isOptional ? "Optional" : "Public"}
                        </Badge>
                        {canWrite && (
                          <button
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Delete ${h.name}?`,
                                description: `Remove ${h.name} from the ${selectedYear} calendar?`,
                                confirmLabel: "Delete",
                              });
                              if (ok) deleteHoliday.mutate(h.id);
                            }}
                            className="p-1 text-muted-foreground hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </QueryState>
        </CardContent>
      </Card>

      {/* Add Holiday Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Holiday"
        description={`Add an observance or holiday to the ${selectedYear} calendar.`}
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createHoliday.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Holiday Name *</label>
            <Input
              placeholder="e.g. Diwali / Republic Day / Independence Day"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <DatePicker
            label="Date"
            value={date}
            onChange={(val) => setDate(val)}
            isRequired
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              id="isOptionalCheck"
              type="checkbox"
              checked={isOptional}
              onChange={(e) => setIsOptional(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
            />
            <label htmlFor="isOptionalCheck" className="text-xs font-medium text-foreground cursor-pointer">
              Optional / Restricted Holiday (employees choose from an allowed pool)
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !date || createHoliday.isPending}
            >
              {createHoliday.isPending ? "Adding…" : "Add Holiday"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
