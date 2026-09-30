import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Plus,
  Trash2,
  Search,
  Building2,
  Award,
  Sparkles,
  Layers,
  X,
  CheckCircle2,
} from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { Modal } from "../components/ui/modal";
import { HeaderActionPortal } from "../components/header-action-portal";
import { useConfirm } from "../hooks/use-confirm";
import { toast } from "../components/ui/toast";
import { formatErrorMessage } from "../lib/error-formatter";
import { cn } from "../lib/utils";

interface NamedRecord {
  id: string;
  name: string;
}

interface Person {
  id: string;
  designationId?: string | null;
}

/** Suggested common titles for quick 1-tap addition */
const COMMON_SUGGESTIONS = [
  "Chief Executive Officer",
  "Director of Operations",
  "Lead Software Engineer",
  "Senior Frontend Developer",
  "Human Resources Manager",
  "Finance & Payroll Analyst",
  "Customer Support Specialist",
  "Operations Associate",
];

/** Shared by Designations and other simple named masters */
export function SimpleNamedListPage({ title, apiPath }: { title: string; apiPath: string }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const queryKey = ["admin", apiPath];
  const singular = title.replace(/s$/, "");

  // Main data query
  const {
    data: records = [],
    isLoading,
    error,
  } = useQuery({ queryKey, queryFn: () => api.get<NamedRecord[]>(apiPath) });

  // Optional person count cross-reference to show how many employees hold this designation
  const { data: persons = [] } = useQuery({
    queryKey: ["hr", "persons"],
    queryFn: () => api.get<Person[]>("/hr/persons"),
    staleTime: 60_000,
  });

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");

  // Map of counts per record ID
  const memberCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of persons) {
      if (p.designationId) {
        map.set(p.designationId, (map.get(p.designationId) ?? 0) + 1);
      }
    }
    return map;
  }, [persons]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => r.name.toLowerCase().includes(q));
  }, [records, searchQuery]);

  // Create mutation
  const create = useMutation({
    mutationFn: () => api.post<NamedRecord>(apiPath, { name: name.trim() }),
    onSuccess: (record) => {
      const createdName = record?.name || name.trim();
      setName("");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${singular} created`, `"${createdName}" added successfully.`);
    },
    onError: (err) => {
      toast.error(`Failed to create ${singular.toLowerCase()}`, formatErrorMessage(err));
    },
  });

  // Delete mutation
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${apiPath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${singular} deleted`, "The record has been permanently removed.");
    },
    onError: (err) => {
      toast.error(`Failed to delete ${singular.toLowerCase()}`, formatErrorMessage(err));
    },
  });

  const handleDelete = async (row: NamedRecord) => {
    const assignedCount = memberCounts.get(row.id) ?? 0;
    const ok = await confirm({
      title: `Delete ${singular} "${row.name}"?`,
      description:
        assignedCount > 0
          ? `There are currently ${assignedCount} person${
              assignedCount === 1 ? "" : "s"
            } assigned to this ${singular.toLowerCase()}. Deleting it will leave their placement unassigned.`
          : `This action cannot be undone. This ${singular.toLowerCase()} will be removed immediately.`,
      confirmLabel: "Delete Record",
    });
    if (ok) remove.mutate(row.id);
  };

  const stats = useMemo(() => {
    const total = records.length;
    let assignedTotal = 0;
    for (const count of memberCounts.values()) {
      assignedTotal += count;
    }

    return [
      { label: `Total ${title}`, value: total },
      { label: "Assigned Staff", value: assignedTotal },
      { label: "Active Roles", value: total },
    ];
  }, [records, memberCounts, title]);

  return (
    <div className="max-w-[1720px] mx-auto space-y-5 px-3 sm:px-6 py-4">
      {/* Top Header Portal Button */}
      <HeaderActionPortal>
        <Button onClick={() => setModalOpen(true)} size="sm" className="h-9 gap-1.5 font-medium shadow-xs">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add {singular}</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </HeaderActionPortal>

      {/* Modern Page Header */}
      <PageHeader
        title={title}
        description={`Manage the hierarchical ${title.toLowerCase()}, job titles, and operational roles used across your organisation.`}
        icon={Briefcase}
        stats={stats}
        action={
          <Button onClick={() => setModalOpen(true)} className="h-9 gap-1.5 font-medium shadow-xs">
            <Plus className="h-4 w-4" />
            <span>Add New {singular}</span>
          </Button>
        }
      />

      {/* Search and Action Toolbar */}
      <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${title.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Badge variant="secondary" className="text-xs px-2.5 py-1 font-medium self-start sm:self-auto">
              {filteredRecords.length} {filteredRecords.length === 1 ? singular : title}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid View */}
      <QueryState isLoading={isLoading} error={error}>
        {filteredRecords.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredRecords.map((row) => {
              const assignedCount = memberCounts.get(row.id) ?? 0;

              return (
                <div
                  key={row.id}
                  className="group relative flex flex-col justify-between p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                        <Award className="h-4.5 w-4.5" />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="p-1 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-70 group-hover:opacity-100"
                        title={`Delete ${singular}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-foreground leading-snug tracking-tight line-clamp-2">
                      {row.name}
                    </h3>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Assigned Staff</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                        assignedCount > 0
                          ? "bg-primary/5 text-primary border-primary/20"
                          : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-zinc-200 dark:border-zinc-700",
                      )}
                    >
                      {assignedCount} {assignedCount === 1 ? "member" : "members"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="rounded-2xl border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No {title.toLowerCase()} found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
              {searchQuery
                ? "No records match your query. Try a different search term."
                : `Get started by creating your organisation's first ${singular.toLowerCase()}.`}
            </p>
            <Button onClick={() => setModalOpen(true)} size="sm" className="h-8.5 gap-1.5 font-medium shadow-xs">
              <Plus className="h-4 w-4" />
              <span>Add {singular}</span>
            </Button>
          </Card>
        )}
      </QueryState>

      {/* ── ADD DESIGNATION MODAL ────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Add New ${singular}`}
        description={`Define a title to assign personnel across departments and reporting hierarchy.`}
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {singular} Title <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder={`e.g. Lead Software Engineer, Chief Executive Officer`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="h-9.5 text-sm bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
            />
          </div>

          {/* Quick Suggestions */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Common Job Titles
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setName(suggestion)}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              className="h-8.5 text-xs font-medium rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || create.isPending}
              className="h-8.5 text-xs font-medium rounded-xl gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add {singular}</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
