import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Upload,
  Download,
  Trash2,
  FileText,
  UserCheck,
  Building,
  Briefcase,
  Calendar,
  Phone,
  Mail,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { api, ApiError } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { DateInput } from "../../components/ui/date-input";
import { Badge } from "../../components/ui/badge";
import { User, Avatar } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal, Drawer } from "../../components/ui/modal";
import { useConfirm } from "../../hooks/use-confirm";
import { toast } from "../../components/ui/toast";
import { useAuthStore } from "../../auth/auth-store";
import { formatErrorMessage } from "../../lib/error-formatter";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

interface DepartmentOption {
  id: string;
  name: string;
}

interface DesignationOption {
  id: string;
  name: string;
}

interface PersonDocument {
  id: string;
  name: string;
  category: "KYC" | "RESUME" | "CONTRACT" | "CERTIFICATE" | "OTHER";
  fileKey: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface Person {
  id: string;
  personType: "EMPLOYEE" | "VOLUNTEER";
  status: "ACTIVE" | "ON_NOTICE" | "EXITED";
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  joiningDate?: string | null;
  exitDate?: string | null;
  exitReason?: string | null;
  departmentId?: string | null;
  department?: DepartmentOption | null;
  designationId?: string | null;
  designation?: DesignationOption | null;
  managerId?: string | null;
  manager?: { id: string; firstName: string; lastName: string; email: string } | null;
  directReports?: { id: string; firstName: string; lastName: string; email: string; personType: string }[];
  documents?: PersonDocument[];
}

export function PeoplePage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter States
  const [personTypeFilter, setPersonTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Modals & Drawer State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [exitModalOpen, setExitModalOpen] = useState(false);

  // New Person Form State
  const [newPersonType, setNewPersonType] = useState<"EMPLOYEE" | "VOLUNTEER">("EMPLOYEE");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [joiningDate, setJoiningDate] = useState("");

  // Document Upload State
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState<"KYC" | "RESUME" | "CONTRACT" | "CERTIFICATE" | "OTHER">("KYC");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Exit Workflow State
  const [exitDate, setExitDate] = useState("");
  const [exitReason, setExitReason] = useState("");

  // Queries
  const {
    data: people,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["hr", "people", personTypeFilter, statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (personTypeFilter !== "ALL") params.set("personType", personTypeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      return api.get<Person[]>(`/hr/persons?${params.toString()}`);
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => api.get<DepartmentOption[]>("/admin/departments"),
  });

  const { data: designations } = useQuery({
    queryKey: ["admin", "designations"],
    queryFn: () => api.get<DesignationOption[]>("/admin/designations"),
  });

  // Selected person detail query for Drawer
  const { data: selectedPerson, refetch: refetchSelectedPerson } = useQuery({
    queryKey: ["hr", "people", selectedPersonId],
    queryFn: () => api.get<Person>(`/hr/persons/${selectedPersonId}`),
    enabled: !!selectedPersonId,
  });

  // Mutations
  const createPerson = useMutation({
    mutationFn: () =>
      api.post<Person>("/hr/persons", {
        personType: newPersonType,
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        departmentId: departmentId || undefined,
        designationId: designationId || undefined,
        managerId: managerId || undefined,
        joiningDate: joiningDate ? new Date(joiningDate).toISOString() : undefined,
      }),
    onSuccess: (p) => {
      setCreateModalOpen(false);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      toast.success(
        `${newPersonType === "EMPLOYEE" ? "Employee" : "Volunteer"} onboarded`,
        `${p.firstName} ${p.lastName} added successfully.`,
      );
    },
    onError: (err) => {
      toast.error("Failed to add person", (err as Error).message);
    },
  });

  const exitPerson = useMutation({
    mutationFn: () =>
      api.patch(`/hr/persons/${selectedPersonId}/exit`, {
        exitDate: new Date(exitDate).toISOString(),
        exitReason,
      }),
    onSuccess: () => {
      setExitModalOpen(false);
      setExitDate("");
      setExitReason("");
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      refetchSelectedPerson();
      toast.success("Exit recorded", "Person status updated to Exited.");
    },
    onError: (err) => {
      toast.error("Failed to process exit", (err as Error).message);
    },
  });

  const deleteDoc = useMutation({
    mutationFn: ({ docId }: { docId: string }) =>
      api.delete(`/hr/persons/${selectedPersonId}/documents/${docId}`),
    onSuccess: () => {
      refetchSelectedPerson();
      toast.success("Document removed", "File has been removed from storage.");
    },
    onError: (err) => {
      toast.error("Failed to delete document", (err as Error).message);
    },
  });

  const resetCreateForm = () => {
    setNewPersonType("EMPLOYEE");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setDepartmentId("");
    setDesignationId("");
    setManagerId("");
    setJoiningDate("");
  };

  const handleUploadDocument = async () => {
    if (!selectedPersonId || !selectedFile || !docName.trim()) return;

    try {
      setUploadingDoc(true);
      const accessToken = useAuthStore.getState().user?.access_token;
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", docName.trim());
      formData.append("category", docCategory);

      const res = await fetch(`${API_BASE_URL}/hr/persons/${selectedPersonId}/documents`, {
        method: "POST",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const rawText = await res.text().catch(() => "");
        throw new Error(formatErrorMessage(rawText || res.statusText));
      }

      setDocName("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetchSelectedPerson();
      toast.success("Document uploaded", "File uploaded securely to MinIO object storage.");
    } catch (err: any) {
      toast.error("Upload failed", err.message || "Could not upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDoc = async (docId: string, docName: string) => {
    try {
      const data = await api.get<{ url: string }>(
        `/hr/persons/${selectedPersonId}/documents/${docId}/url`,
      );
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Download failed", err.message || "Could not generate download link.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Person Master"
          description="Manage employee and volunteer profiles, reporting hierarchies, and records."
        />
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shrink-0">
          <UserPlus className="h-4 w-4" />
          <span>New Person</span>
        </Button>
      </div>

      {/* Filters and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Type:</span>
            {["ALL", "EMPLOYEE", "VOLUNTEER"].map((t) => (
              <button
                key={t}
                onClick={() => setPersonTypeFilter(t)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  personTypeFilter === t
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "ALL" ? "All People" : t === "EMPLOYEE" ? "Employees" : "Volunteers"}
              </button>
            ))}

            <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

            <span className="text-xs font-semibold text-muted-foreground mr-1">Status:</span>
            {["ALL", "ACTIVE", "ON_NOTICE", "EXITED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "ALL" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* People Table */}
      <Card>
        <CardContent className="p-0">
          <QueryState isLoading={isLoading} error={error}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Department & Role</TableHead>
                  <TableHead>Reporting Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                      No records found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  people?.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      onClick={() => setSelectedPersonId(p.id)}
                    >
                      <TableCell>
                        <User
                          name={`${p.firstName} ${p.lastName}`}
                          description={p.email}
                          avatarProps={{
                            size: "sm",
                            isBordered: true,
                            status: p.status === "ACTIVE" ? "online" : undefined,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={p.personType === "EMPLOYEE" ? "default" : "secondary"}
                          size="sm"
                        >
                          {p.personType === "EMPLOYEE" ? "Employee" : "Volunteer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-foreground">
                            {p.designation?.name || "No designation"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {p.department?.name || "No department"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.manager ? (
                          <span className="text-xs text-foreground font-medium">
                            {p.manager.firstName} {p.manager.lastName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">None (Top-level)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "ACTIVE"
                              ? "success"
                              : p.status === "ON_NOTICE"
                              ? "warning"
                              : "secondary"
                          }
                          dot
                          size="sm"
                        >
                          {p.status === "ACTIVE"
                            ? "Active"
                            : p.status === "ON_NOTICE"
                            ? "On Notice"
                            : "Exited"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPersonId(p.id)}
                          className="text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>

      {/* New Person Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Onboard New Person"
        description="Add a staff member or volunteer to your organisation."
        maxWidth="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPerson.mutate();
          }}
          className="space-y-4"
        >
          {/* Person Type Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Person Classification
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewPersonType("EMPLOYEE")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  newPersonType === "EMPLOYEE"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Briefcase className="h-4 w-4" />
                Employee
              </button>
              <button
                type="button"
                onClick={() => setNewPersonType("VOLUNTEER")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  newPersonType === "VOLUNTEER"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserCheck className="h-4 w-4" />
                Volunteer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">First Name *</label>
              <Input
                placeholder="Ramesh"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Last Name *</label>
              <Input
                placeholder="Kumar"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Email Address *</label>
              <Input
                type="email"
                placeholder="ramesh@example.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Phone Number</label>
              <Input
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Select Department</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <Select
              label="Designation"
              value={designationId}
              onChange={(e) => setDesignationId(e.target.value)}
            >
              <option value="">Select Designation</option>
              {designations?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Reporting Manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">None (Top-Level Executive)</option>
              {people
                ?.filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.designation?.name || p.email})
                  </option>
                ))}
            </Select>
            <DateInput
              label="Joining Date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!firstName || !lastName || !email || createPerson.isPending}
            >
              {createPerson.isPending ? "Onboarding…" : "Onboard Person"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Person Detail Drawer */}
      <Drawer
        isOpen={!!selectedPersonId}
        onClose={() => setSelectedPersonId(null)}
        title={selectedPerson ? `${selectedPerson.firstName} ${selectedPerson.lastName}` : "Profile Details"}
        description={selectedPerson?.email}
        width="xl"
      >
        {selectedPerson && (
          <div className="space-y-6">
            {/* Top Identity Card */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Avatar
                  name={`${selectedPerson.firstName} ${selectedPerson.lastName}`}
                  size="md"
                  isBordered
                  status={selectedPerson.status === "ACTIVE" ? "online" : undefined}
                />
                <div>
                  <h4 className="font-bold text-foreground text-sm">
                    {selectedPerson.firstName} {selectedPerson.lastName}
                  </h4>
                  <p className="text-xs text-muted-foreground">{selectedPerson.designation?.name || "Staff Member"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={selectedPerson.personType === "EMPLOYEE" ? "default" : "secondary"}
                >
                  {selectedPerson.personType === "EMPLOYEE" ? "Employee" : "Volunteer"}
                </Badge>
                <Badge
                  variant={
                    selectedPerson.status === "ACTIVE"
                      ? "success"
                      : selectedPerson.status === "ON_NOTICE"
                      ? "warning"
                      : "secondary"
                  }
                  dot
                >
                  {selectedPerson.status}
                </Badge>
              </div>
            </div>

            {/* Quick Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Building className="h-3.5 w-3.5" /> Department
                </span>
                <span className="font-semibold text-foreground">
                  {selectedPerson.department?.name || "Not assigned"}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-muted-foreground flex items-center gap-1.5 mb-1">
                  <UserCheck className="h-3.5 w-3.5" /> Reporting Manager
                </span>
                <span className="font-semibold text-foreground">
                  {selectedPerson.manager
                    ? `${selectedPerson.manager.firstName} ${selectedPerson.manager.lastName}`
                    : "None"}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Phone className="h-3.5 w-3.5" /> Contact
                </span>
                <span className="font-semibold text-foreground">
                  {selectedPerson.phone || "Not recorded"}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5" /> Joined On
                </span>
                <span className="font-semibold text-foreground">
                  {selectedPerson.joiningDate
                    ? new Date(selectedPerson.joiningDate).toLocaleDateString()
                    : "Not recorded"}
                </span>
              </div>
            </div>

            {/* Direct Reports Section (if any) */}
            {selectedPerson.directReports && selectedPerson.directReports.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Direct Reports ({selectedPerson.directReports.length})
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  {selectedPerson.directReports.map((dr) => (
                    <div
                      key={dr.id}
                      className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs flex items-center justify-between"
                    >
                      <span className="font-medium text-foreground">
                        {dr.firstName} {dr.lastName}
                      </span>
                      <Badge size="sm" variant="secondary">
                        {dr.personType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents Section (MinIO Object Storage) */}
            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Documents & KYC
                  </h5>
                  <p className="text-[11px] text-muted-foreground">Stored securely in MinIO Object Storage</p>
                </div>
              </div>

              {/* Upload Form */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-foreground block mb-1">
                      Document Title *
                    </label>
                    <Input
                      placeholder="e.g. Aadhaar Card / Resume"
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                    <Select
                      label="Category"
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as any)}
                      className="h-8 text-xs"
                    >
                      <option value="KYC">KYC Document</option>
                      <option value="RESUME">Resume / CV</option>
                      <option value="CONTRACT">Contract / Offer Letter</option>
                      <option value="CERTIFICATE">Certificate / Degree</option>
                      <option value="OTHER">Other Record</option>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="flex-1 text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                  <Button
                    size="sm"
                    onClick={handleUploadDocument}
                    disabled={!selectedFile || !docName.trim() || uploadingDoc}
                    className="shrink-0 gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingDoc ? "Uploading…" : "Upload"}</span>
                  </Button>
                </div>
              </div>

              {/* Uploaded Documents List */}
              <div className="space-y-2">
                {selectedPerson.documents?.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No documents uploaded for this person yet.
                  </p>
                ) : (
                  selectedPerson.documents?.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <Badge size="sm" variant="secondary">
                              {doc.category}
                            </Badge>
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>•</span>
                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleDownloadDoc(doc.id, doc.name)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Download document (presigned MinIO link)"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Delete ${doc.name}?`,
                              description: "This document will be permanently removed from MinIO storage.",
                              confirmLabel: "Delete",
                            });
                            if (ok) deleteDoc.mutate({ docId: doc.id });
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Resignation / Exit Action */}
            {selectedPerson.status !== "EXITED" && (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <h6 className="text-xs font-semibold text-foreground">Offboarding / Exit</h6>
                  <p className="text-[11px] text-muted-foreground">Record resignation or completion of contract.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExitModalOpen(true)}
                  className="gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Process Exit
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Exit Workflow Modal */}
      <Modal
        isOpen={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        title="Record Exit / Resignation"
        description="Mark this person as exited and specify departure details."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            exitPerson.mutate();
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Effective Exit Date *</label>
            <Input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Reason for Leaving *</label>
            <Input
              placeholder="e.g. Relocated / Better opportunity / Contract completed"
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setExitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!exitDate || !exitReason.trim() || exitPerson.isPending}
            >
              {exitPerson.isPending ? "Processing…" : "Confirm Exit"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
