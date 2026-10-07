import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Mail, Network, Phone, Plus, Trash2, UserPlus, UserX } from "lucide-react";
import { ApiError, api } from "../api/client";
import { useMe } from "../auth/use-me";
import { PageHeader } from "../components/page-header";
import { QueryState } from "../components/query-state";
import { Avatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { PersonForm } from "../components/hr/PersonForm";
import { Modal } from "../components/ui/modal";
import { SearchInput } from "../components/ui/search-input";
import { Select } from "../components/ui/select";
import { toast } from "../components/ui/toast";
import { useConfirm } from "../hooks/use-confirm";
import { formatErrorMessage } from "../lib/error-formatter";
import { fullName } from "../lib/input-constraints";
import { cn } from "../lib/utils";

interface Name {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}
interface DeptPerson extends Name {
  id: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string;
  managerId?: string | null;
  designation?: { id: string; name: string } | null;
  directReports?: Array<{ id: string }>;
}
interface Department {
  id: string;
  name: string;
  persons: DeptPerson[];
}
interface PersonItem extends Name {
  id: string;
  email?: string;
  status?: string;
  departmentId?: string | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
}
interface Designation {
  id: string;
  name: string;
}

const headOf = (d: Department) =>
  d.persons.find((p) => (p.directReports?.length ?? 0) > 0 && !d.persons.some((o) => o.id === p.managerId)) ?? null;

const label = "text-xs font-medium text-muted-foreground block mb-1";

export function AdminDepartmentsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: me } = useMe();
  const can = (k: string) => Boolean(me?.permissionKeys?.includes(k));
  const canWrite = can("admin.department.write");
  const canDelete = can("admin.department.delete");
  const canAddPerson = can("hr.person.write");

  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [addTo, setAddTo] = useState<Department | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [pickId, setPickId] = useState("");

  const depts = useQuery({
    queryKey: ["admin", "departments", "rich"],
    queryFn: () => api.get<Department[]>("/admin/departments"),
  });
  const people = useQuery({
    queryKey: ["hr", "people", "minimal"],
    queryFn: () => api.get<PersonItem[]>("/hr/persons"),
    enabled: canWrite,
  });
  const designations = useQuery({
    queryKey: ["admin", "designations", "list"],
    queryFn: () => api.get<Designation[]>("/admin/designations"),
    enabled: canAddPerson,
  });
  const deptOptions = useQuery({
    queryKey: ["admin", "departments", "options"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/admin/departments"),
    enabled: canAddPerson,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "departments"] });
    qc.invalidateQueries({ queryKey: ["admin", "/admin/departments"] });
    qc.invalidateQueries({ queryKey: ["hr", "people"] });
  };
  const fail = (title: string) => (e: unknown) => toast.error(title, formatErrorMessage(e));

  const createDept = useMutation({
    mutationFn: () => api.post("/admin/departments", { name: deptName.trim() }),
    onSuccess: () => {
      refresh();
      setDeptName("");
      setAddDeptOpen(false);
      toast.success("Department added");
    },
    onError: fail("Could not add department"),
  });
  const deleteDept = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/departments/${id}`),
    onSuccess: () => {
      refresh();
      toast.success("Department deleted");
    },
    onError: fail("Could not delete department"),
  });
  const assign = useMutation({
    mutationFn: (v: { deptId: string; personId: string; managerId?: string | null }) =>
      api.patch(`/admin/departments/${v.deptId}/members`, { personId: v.personId, managerId: v.managerId }),
    onSuccess: () => {
      refresh();
      setAddTo(null);
      setPickId("");
      toast.success("Staff added");
    },
    onError: fail("Could not add staff"),
  });
  const remove = useMutation({
    mutationFn: (v: { deptId: string; personId: string }) => api.delete(`/admin/departments/${v.deptId}/members/${v.personId}`),
    onSuccess: () => {
      refresh();
      toast.success("Staff removed");
    },
    onError: fail("Could not remove staff"),
  });
  const setHead = useMutation({
    mutationFn: (v: { dept: Department; headId: string }) =>
      api.post(`/admin/departments/${v.dept.id}/head`, { personId: v.headId }),
    onSuccess: () => {
      refresh();
      toast.success("Head updated");
    },
    onError: fail("Could not update head"),
  });
  const createPerson = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<{ inviteSent?: boolean; message?: string }>("/hr/persons", { ...payload, departmentId: addTo?.id }),
    onSuccess: (res) => {
      refresh();
      setAddTo(null);
      toast.success("Staff created");
      if (res?.inviteSent === false && res.message) toast.info("Invitation not sent", res.message);
    },
    onError: (e: unknown) =>
      e instanceof ApiError && e.status === 403
        ? toast.error("Could not create staff", "You can't assign this designation.")
        : fail("Could not create staff")(e),
  });

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (depts.data ?? []).filter((d) => !q || d.name.toLowerCase().includes(q));
  }, [depts.data, search]);

  const candidates = useMemo(
    () =>
      (people.data ?? [])
        .filter((p) => addTo && p.departmentId !== addTo.id)
        .map((p) => ({
          value: p.id,
          label: fullName(p),
          description: p.designation?.name,
        })),
    [people.data, addTo],
  );

  const openAdd = (d: Department) => {
    setAddTo(d);
    setMode("existing");
    setPickId("");
  };

  return (
    <div className="w-full space-y-4">
      <PageHeader title="Departments" icon={Network} description="" />

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search departments"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72"
        />
        {canWrite && (
          <Button size="sm" onClick={() => setAddDeptOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add department
          </Button>
        )}
      </div>

      <QueryState isLoading={depts.isLoading} error={depts.error}>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No departments found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {list.map((d) => {
              const head = headOf(d);
              const open = openId === d.id;
              return (
                <div key={d.id} className="rounded-2xl border border-border bg-card text-card-foreground overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : d.id)}
                    className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-muted/40 transition-colors"
                    aria-expanded={open}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{d.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {head ? (
                          <div className="relative group/head flex items-center gap-1.5 min-w-0">
                            <Avatar name={fullName(head)} src={head.avatarUrl} size="xs" />
                            <span className="truncate">{fullName(head)}</span>
                            {/* Contact Details Hover Card for Head */}
                            <div className="pointer-events-none opacity-0 group-hover/head:opacity-100 group-hover/head:pointer-events-auto transition-all duration-200 delay-75 absolute left-0 bottom-full mb-2 z-50 w-60 p-3 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-xl text-xs space-y-2 text-left">
                              <div className="flex items-center gap-2 pb-1.5 border-b border-border">
                                <Avatar name={fullName(head)} src={head.avatarUrl} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-foreground truncate">{fullName(head)}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{head.designation?.name || "Department Head"}</p>
                                </div>
                              </div>
                              <div className="space-y-1 text-[11px]">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Mail className="h-3 w-3 text-primary shrink-0" />
                                  {head.email ? (
                                    <span className="truncate text-foreground font-medium">{head.email}</span>
                                  ) : (
                                    <span className="italic text-zinc-400">No email</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Phone className="h-3 w-3 text-primary shrink-0" />
                                  {head.phone ? (
                                    <span className="truncate text-foreground font-medium font-mono">{head.phone}</span>
                                  ) : (
                                    <span className="italic text-zinc-400">No phone</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span>No head</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{d.persons.length}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </button>

                  {open && (
                    <div className="border-t border-border p-4 space-y-3">
                      {canWrite && d.persons.length > 0 && (
                        <div>
                          <span className={label}>Head</span>
                          <Select
                            size="sm"
                            value={head?.id ?? ""}
                            placeholder="Select head"
                            options={d.persons.map((p) => ({ value: p.id, label: fullName(p) }))}
                            onChange={(e) => e.target.value && setHead.mutate({ dept: d, headId: e.target.value })}
                            disabled={setHead.isPending}
                          />
                        </div>
                      )}

                      {d.persons.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No staff yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {d.persons.map((p) => (
                            <li key={p.id} className="relative group/person flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-muted/40 transition-colors">
                              <Avatar name={fullName(p)} src={p.avatarUrl} size="sm" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{fullName(p)}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {p.designation?.name || "No designation"}
                                </p>
                              </div>

                              {/* Contact Details Hover Card */}
                              <div className="pointer-events-none opacity-0 group-hover/person:opacity-100 group-hover/person:pointer-events-auto transition-all duration-200 delay-75 absolute left-10 bottom-full mb-1.5 z-50 w-64 p-3 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-xl text-xs space-y-2.5">
                                <div className="flex items-center gap-2.5 pb-2 border-b border-border">
                                  <Avatar name={fullName(p)} src={p.avatarUrl} size="sm" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground truncate">{fullName(p)}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{p.designation?.name || "No designation"}</p>
                                  </div>
                                </div>
                                <div className="space-y-1.5 text-[11px]">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                                    {p.email ? (
                                      <a href={`mailto:${p.email}`} className="truncate hover:text-primary transition-colors text-foreground font-medium underline-offset-2 hover:underline">
                                        {p.email}
                                      </a>
                                    ) : (
                                      <span className="italic text-zinc-400">No email available</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                                    {p.phone ? (
                                      <a href={`tel:${p.phone}`} className="truncate hover:text-primary transition-colors text-foreground font-medium font-mono">
                                        {p.phone}
                                      </a>
                                    ) : (
                                      <span className="italic text-zinc-400">No phone available</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {canWrite && (
                                <button
                                  type="button"
                                  title="Remove from department"
                                  aria-label={`Remove ${fullName(p)}`}
                                  disabled={remove.isPending}
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: `Remove ${fullName(p)}?`,
                                      description: `They will be removed from ${d.name}.`,
                                      confirmLabel: "Remove",
                                    });
                                    if (ok) remove.mutate({ deptId: d.id, personId: p.id });
                                  }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer"
                                >
                                  <UserX className="h-4 w-4" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        {canWrite ? (
                          <Button variant="ghost" size="sm" onClick={() => openAdd(d)} className="gap-1.5 text-primary">
                            <UserPlus className="h-4 w-4" /> Add staff
                          </Button>
                        ) : (
                          <span />
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            title="Delete department"
                            aria-label={`Delete ${d.name}`}
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Delete "${d.name}"?`,
                                description: "Staff in this department will become unassigned.",
                                confirmLabel: "Delete",
                              });
                              if (ok) deleteDept.mutate(d.id);
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </QueryState>

      <Modal isOpen={addDeptOpen} onClose={() => setAddDeptOpen(false)} title="Add department" maxWidth="sm">
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (deptName.trim()) createDept.mutate();
          }}
        >
          <Input placeholder="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} autoFocus required />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setAddDeptOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!deptName.trim() || createDept.isPending}>
              {createDept.isPending ? "Adding..." : "Add"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!addTo} onClose={() => setAddTo(null)} title={addTo ? `Add staff to ${addTo.name}` : "Add staff"} maxWidth={mode === "new" ? "4xl" : "md"}>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
            {(["existing", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={m === "new" && !canAddPerson}
                className={cn(
                  "rounded-lg py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                  mode === m ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
                )}
              >
                {m === "existing" ? "Existing staff" : "Create new staff"}
              </button>
            ))}
          </div>

          {mode === "existing" ? (
            <>
              <Select
                searchable
                value={pickId}
                placeholder="Search staff"
                options={candidates}
                onChange={(e) => setPickId(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAddTo(null)}>Cancel</Button>
                <Button
                  disabled={!pickId || assign.isPending}
                  onClick={() => addTo && assign.mutate({ deptId: addTo.id, personId: pickId })}
                >
                  {assign.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
            </>
          ) : (
            addTo && (
              <PersonForm
                mode="create"
                lockedDepartmentId={addTo.id}
                departments={deptOptions.data ?? [{ id: addTo.id, name: addTo.name }]}
                designations={designations.data}
                managers={people.data}
                isSubmitting={createPerson.isPending}
                submitLabel="Create staff"
                onCancel={() => setAddTo(null)}
                onSubmit={(payload) => createPerson.mutate(payload)}
              />
            )
          )}
        </div>
      </Modal>
    </div>
  );
}
