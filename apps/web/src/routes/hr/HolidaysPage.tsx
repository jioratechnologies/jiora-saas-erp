import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Calendar, Star } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal } from "../../components/ui/modal";
import { useConfirm } from "../../hooks/use-confirm";
import { toast } from "../../components/ui/toast";
import { useMe } from "../../auth/use-me";

interface Holiday {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
}

export function HolidaysPage() {
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
      toast.error("Failed to add holiday", (err as Error).message);
    },
  });

  const deleteHoliday = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "holidays"] });
      toast.success("Holiday deleted", "Removed from annual calendar.");
    },
    onError: (err) => {
      toast.error("Failed to delete holiday", (err as Error).message);
    },
  });

  const canWrite = me?.permissionKeys?.includes("hr.holiday.write");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Holiday Calendar"
          description="Annual paid holidays, national observances, and optional festival leaves."
        />
        <div className="flex items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200/80 dark:border-zinc-800">
            {[2025, 2026, 2027].map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
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
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              <span>Add Holiday</span>
            </Button>
          )}
        </div>
      </div>

      {/* Holidays Table */}
      <Card>
        <CardContent className="p-0">
          <QueryState isLoading={isLoading} error={error}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Date</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Day of Week</TableHead>
                  <TableHead>Classification</TableHead>
                  {canWrite && <TableHead className="w-16 text-right" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                      No holidays configured for the year {selectedYear}.
                    </TableCell>
                  </TableRow>
                ) : (
                  holidays?.map((h) => {
                    const holidayDate = new Date(h.date);
                    return (
                      <TableRow key={h.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                              <span className="text-[10px] font-bold uppercase leading-none">
                                {holidayDate.toLocaleDateString(undefined, { month: "short" })}
                              </span>
                              <span className="text-sm font-extrabold leading-tight">
                                {holidayDate.getDate()}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-foreground">
                              {holidayDate.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground text-sm">
                          {h.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {holidayDate.toLocaleDateString(undefined, { weekday: "long" })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={h.isOptional ? "warning" : "success"}
                            size="sm"
                            dot
                          >
                            {h.isOptional ? "Optional / Restricted" : "Mandatory / Public"}
                          </Badge>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <button
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Delete ${h.name}?`,
                                  description: `Are you sure you want to remove ${h.name} from the ${selectedYear} calendar?`,
                                  confirmLabel: "Delete",
                                });
                                if (ok) deleteHoliday.mutate(h.id);
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
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

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Date *</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

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
