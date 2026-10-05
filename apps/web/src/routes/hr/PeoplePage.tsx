import { SearchInput } from "../../components/ui/search-input";
import { memo, useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  UserPlus,
  Search,
  Upload,
  Download,
  Trash2,
  FileText,
  UserCheck,
  Building,
  Calendar,
  Phone,
  Mail,
  LogOut,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Lock,
  Eye,
  Edit3,
  HeartHandshake,
  ShieldCheck,
  Building2,
  Filter,
  Network,
  Users,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { api, ApiError } from "../../api/client";
import { Button } from "../../components/ui/button";
import { ButtonGroup } from "../../components/ui/button-group";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { DateInput } from "../../components/ui/date-input";
import { FileDropzone } from "../../components/ui/file-dropzone";
import { Badge } from "../../components/ui/badge";
import { User, Avatar } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import { Skeleton } from "../../components/ui/skeleton";
import { usePagedQuery } from "../../lib/use-paged-query";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal, Drawer } from "../../components/ui/modal";
import { PersonForm } from "../../components/hr/PersonForm";
import { useConfirm } from "../../hooks/use-confirm";
import { toast } from "../../components/ui/toast";
import { useAuthStore } from "../../auth/auth-store";
import { useMe } from "../../auth/use-me";
import { formatErrorMessage } from "../../lib/error-formatter";
import {
  INPUT_LIMITS,
  fullName,
  normalizeGender,
  PHONE_REGEX,
} from "../../lib/input-constraints";
import { cn } from "../../lib/utils";
import { KYC_ID_TYPES, OTHER_ID_TYPE, kycHint } from "../../lib/kyc-types";
import { exportToExcel } from "../../lib/excel-export";

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
  category: "KYC" | "RESUME" | "JOINING_LETTER" | "CONTRACT" | "OTHER";
  fileKey: string;
  sizeBytes?: number;
  fileSize?: number;
  mimeType: string;
  documentNumber?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  uploadedAt?: string;
  createdAt?: string;
}

interface Person {
  id: string;
  personType: "EMPLOYEE" | "VOLUNTEER";
  status: "JOINED" | "PROBATION" | "ACTIVE" | "NOTICE_PERIOD" | "EXITED";
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phone?: string | null;
  altPhone?: string | null;
  gender?: string | null;
  dob?: string | null;
  address?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  emergencyContact?: string | null;
  avatarUrl?: string | null;
  joiningDate?: string | null;
  exitDate?: string | null;
  exitReason?: string | null;
  exitChecklist?: {
    assetReturn?: boolean;
    idCardReturn?: boolean;
    knowledgeHandover?: boolean;
    financeClearance?: boolean;
    notes?: string;
    completedAt?: string;
  } | null;
  departmentId?: string | null;
  department?: DepartmentOption | null;
  designationId?: string | null;
  designation?: DesignationOption | null;
  managerId?: string | null;
  manager?: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    department?: DepartmentOption | null;
    designation?: DesignationOption | null;
    manager?: { id: string; firstName: string; middleName?: string | null; lastName: string } | null;
  } | null;
  directReports?: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    personType?: string;
    department?: DepartmentOption | null;
    designation?: DesignationOption | null;
    status?: string;
  }[];
  documents?: PersonDocument[];
}

const PersonCard = memo(function PersonCard({ p, onSelect }: { p: Person; onSelect: (id: string) => void }) {
  return (
                  <div
                                        onClick={() => onSelect(p.id)}
                    className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors cursor-pointer space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={fullName(p)}
                          src={p.avatarUrl || undefined}
                          size="md"
                          isBordered
                          status={p.status === "ACTIVE" ? "online" : undefined}
                          className="shrink-0 h-10 w-10 text-xs"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-sm text-foreground truncate">
                              {fullName(p)}
                            </p>
                            <Badge
                              variant={p.personType === "EMPLOYEE" ? "default" : "secondary"}
                              className="text-[9px] px-1.5 py-0"
                            >
                              {p.personType === "EMPLOYEE" ? "Emp" : "Vol"}
                            </Badge>
                            <Badge
                              variant={
                                p.status === "ACTIVE"
                                  ? "success"
                                  : p.status === "NOTICE_PERIOD"
                                    ? "warning"
                                    : "secondary"
                              }
                              dot
                              className="text-[9px] px-1.5 py-0"
                            >
                              {p.status === "NOTICE_PERIOD" ? "Notice" : p.status.toLowerCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                            {p.designation?.name || "Staff Member"} • {p.department?.name || "No Dept"}
                          </p>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-2" />
                    </div>

                    {/* Mobile Card Footer: Contact & Manager */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-zinc-100/60 dark:border-zinc-800/60">
                      <span className="truncate max-w-[170px]">{p.email}</span>
                      {p.manager ? (
                        <span className="text-[10px] text-primary font-medium truncate">
                          Lead: {p.manager.firstName} {p.manager.lastName[0]}.
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Top Executive</span>
                      )}
                    </div>
                  </div>
  );
});

const PersonRow = memo(function PersonRow({ p, onSelect }: { p: Person; onSelect: (id: string) => void }) {
  return (
                      <TableRow
                                                className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                        onClick={() => onSelect(p.id)}
                      >
                        <TableCell>
                          <User
                            name={fullName(p)}
                            description={p.email}
                            avatarProps={{
                              src: p.avatarUrl || undefined,
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
                              {fullName(p.manager)}
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
                                : p.status === "NOTICE_PERIOD"
                                  ? "warning"
                                  : "secondary"
                            }
                            dot
                            size="sm"
                          >
                            {p.status === "ACTIVE"
                              ? "Active"
                              : p.status === "NOTICE_PERIOD"
                                ? "Notice Period"
                                : p.status === "JOINED"
                                  ? "Joined"
                                  : p.status === "PROBATION"
                                    ? "Probation"
                                    : "Exited"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSelect(p.id)}
                              className="text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 h-8 px-2.5"
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
  );
});

function PeopleSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function MobileSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </>
  );
}

interface FinalSettlement {
  exitDate?: string | null;
  lastWorkingMonth?: string | null;
  expectedDays: number;
  paidDays: number;
  perDayRate: number;
  earnedGross: number;
  adjustmentsTotal: number;
  outstandingAdvanceBalance: number;
  approvedUnsettledClaimsTotal: number;
  estimatedNet: number;
}

/** Final settlement preview for leavers. Hidden silently on 403/404 or any load failure. */
function FinalSettlementCard({ personId }: { personId: string }) {
  const { data } = useQuery({
    queryKey: ["payroll", "final-settlement", personId],
    queryFn: () => api.get<FinalSettlement>(`/payroll/runs/final-settlement/${personId}`),
    retry: false,
  });
  if (!data) return null;
  const money = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;
  const rows: [string, string][] = [
    ["Last working month", data.lastWorkingMonth ?? "-"],
    ["Paid days", `${data.paidDays} / ${data.expectedDays}`],
    ["Earned gross", money(data.earnedGross)],
    ["Adjustments", money(data.adjustmentsTotal)],
    ["Advance outstanding", money(data.outstandingAdvanceBalance)],
    ["Unsettled claims", money(data.approvedUnsettledClaimsTotal)],
  ];
  return (
    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-foreground">Final settlement</span>
        <Link to="/payroll/runs" className="text-[11px] text-primary hover:underline">
          Payroll runs
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map(([k, v]) => (
          <div key={k}>
            <span className="block text-[10px] text-muted-foreground">{k}</span>
            <span className="font-medium text-foreground">{v}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 text-xs">
        <span className="font-semibold">Estimated net</span>
        <span className="font-bold text-foreground">{money(data.estimatedNet)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">Final salary is paid in the exit month's payroll run.</p>
    </div>
  );
}

export function PeoplePage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: me } = useMe();
  const canManage = Boolean(me?.isPlatformContext || me?.permissionKeys?.includes("hr.person.write"));

  // Filter States
  const [personTypeFilter, setPersonTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Modals & Drawer State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Bulk Import State
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkParsedRows, setBulkParsedRows] = useState<any[]>([]);
  const [bulkRowErrors, setBulkRowErrors] = useState<{ row: number; reason: string }[]>([]);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkSendInvites, setBulkSendInvites] = useState(true);
  const canSetSalary = Boolean(me?.permissionKeys?.includes("payroll.salary.manage"));

  // Exit Checklist Drawer State
  const [assetReturn, setAssetReturn] = useState(false);
  const [idCardReturn, setIdCardReturn] = useState(false);
  const [knowledgeHandover, setKnowledgeHandover] = useState(false);
  const [financeClearance, setFinanceClearance] = useState(false);
  const [exitClearanceNotes, setExitClearanceNotes] = useState("");
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizeExitDate, setFinalizeExitDate] = useState("");
  const [finalizeReason, setFinalizeReason] = useState("");
  const [finalizeReassignTo, setFinalizeReassignTo] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);

  // In-App Document Viewer State
  const [viewDocModalOpen, setViewDocModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PersonDocument | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewDocError, setPreviewDocError] = useState<string | null>(null);

  // Document Upload State
  const [docName, setDocName] = useState("");
  const [docIdType, setDocIdType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docCategory, setDocCategory] = useState<"KYC" | "RESUME" | "CONTRACT" | "OTHER">("KYC");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Exit Workflow State
  const [exitDate, setExitDate] = useState("");
  const [exitReason, setExitReason] = useState("");

  // Queries
  const peopleQuery = usePagedQuery<
    Person,
    { items: Person[]; total: number; counts?: { employees: number; volunteers: number; active: number } }
  >({
    key: ["hr", "people", "list"],
    path: "/hr/persons",
    params: {
      personType: personTypeFilter !== "ALL" ? personTypeFilter : undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      departmentId: departmentFilter !== "ALL" ? departmentFilter : undefined,
      search,
    },
    pageSize: 10,
  });
  const paginatedPeople = peopleQuery.items;
  const isLoading = peopleQuery.isLoading;
  const error = peopleQuery.error;
  // Header stats ignore the list filters: separate unfiltered query, cached 60s.
  const { data: headerStats } = useQuery({
    queryKey: ["hr", "people", "header-counts"],
    queryFn: () =>
      api.get<{ total: number; counts?: { employees: number; volunteers: number; active: number } }>(
        "/hr/persons?page=1&pageSize=1",
      ),
    staleTime: 60_000,
  });
  const counts = headerStats?.counts;
  const totalAllStaff = headerStats?.total ?? 0;
  const totalPeople = peopleQuery.total;
  const isFetchingFirst = isLoading;

  // Full unpaged list: only for manager pickers (create/edit/finalize modals).
  const needsAllPeople = createModalOpen || editModalOpen || finalizeModalOpen;
  const { data: people } = useQuery({
    queryKey: ["hr", "people", "all"],
    queryFn: () => api.get<Person[]>("/hr/persons"),
    enabled: needsAllPeople,
    staleTime: 60_000,
  });

  const { data: departments } = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => api.get<DepartmentOption[]>("/admin/departments"),
  });

  const { data: designations } = useQuery({
    queryKey: ["admin", "designations"],
    queryFn: () => api.get<DesignationOption[]>("/admin/designations"),
  });

  const { data: myProfile } = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: () => api.get<any>("/auth/profile"),
  });
  const myDepartmentId = departments?.find(
    (d) => d.name === myProfile?.user?.department || d.name === myProfile?.person?.department
  )?.id;

  // Selected person detail query for Drawer
  const {
    data: selectedPerson,
    refetch: refetchSelectedPerson,
    isLoading: selectedPersonLoading,
    error: selectedPersonError,
  } = useQuery({
    queryKey: ["hr", "people", selectedPersonId],
    queryFn: () => api.get<Person>(`/hr/persons/${selectedPersonId}`),
    enabled: !!selectedPersonId,
  });

  useEffect(() => {
    if (selectedPerson) {
      const chk = selectedPerson.exitChecklist || {};
      setAssetReturn(!!chk.assetReturn);
      setIdCardReturn(!!chk.idCardReturn);
      setKnowledgeHandover(!!chk.knowledgeHandover);
      setFinanceClearance(!!chk.financeClearance);
      setExitClearanceNotes(chk.notes || "");
    }
  }, [selectedPerson]);

  const updateExitChecklist = useMutation({
    mutationFn: ({
      personId,
      checklist,
      isFinalized,
      exitDate: finalExitDate,
      exitReason: finalExitReason,
      reassignReportsTo,
    }: {
      personId: string;
      checklist: any;
      isFinalized?: boolean;
      exitDate?: string;
      exitReason?: string;
      reassignReportsTo?: string;
    }) =>
      api.patch(`/hr/persons/${personId}/exit-checklist`, {
        ...checklist,
        isFinalized,
        ...(isFinalized ? { exitDate: finalExitDate, exitReason: finalExitReason, reassignReportsTo: reassignReportsTo || undefined } : {}),
      }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      if (vars.isFinalized) {
        setFinalizeModalOpen(false);
        setFinalizeReason("");
        setFinalizeReassignTo("");
        refetchSelectedPerson();
        toast.success("Exit finalized", "The record is now marked as exited.");
      } else {
        toast.success("Exit checklist updated", "Offboarding clearance record saved.");
      }
    },
    onError: (err) => {
      toast.error("Failed to update exit checklist", formatErrorMessage(err));
    },
  });

  const bulkImport = useMutation({
    mutationFn: (records: any[]) =>
      api.post<{
        total: number;
        importedCount: number;
        failedCount: number;
        invitedCount?: number;
        failed?: { row: number; email?: string; reason: string }[];
      }>("/hr/persons/bulk-import", { records, sendInvites: bulkSendInvites }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      if (res.failedCount > 0) {
        setBulkParsedRows([]);
        setBulkRowErrors((res.failed ?? []).map((f) => ({ row: f.row, reason: `${f.email ? `${f.email}: ` : ""}${f.reason}` })));
        toast.error(
          "Some rows were not imported",
          `Imported ${res.importedCount} of ${res.total}. Fix the listed rows and upload again.`,
        );
        return;
      }
      toast.success(
        "Bulk import completed",
        `Imported ${res.importedCount} of ${res.total} staff members.${
          typeof res.invitedCount === "number" ? ` ${res.invitedCount} login invitation${res.invitedCount === 1 ? "" : "s"} sent.` : ""
        }`,
      );
      setBulkImportModalOpen(false);
      resetBulkImport();
    },
    onError: (err) => {
      toast.error("Bulk import failed", formatErrorMessage(err));
    },
  });

  const handleExportStaffDirectory = async () => {
    let all: Person[];
    try {
      all = await peopleQuery.fetchAll();
    } catch (e) {
      toast.error("Export failed", formatErrorMessage(e));
      return;
    }
    if (all.length === 0) {
      toast.error("No staff to export", "No records found matching current filters.");
      return;
    }
    const headers = [
      "First Name",
      "Middle Name",
      "Last Name",
      "Email",
      "Phone",
      "Alternate Mobile",
      "Gender",
      "Date of Birth",
      "Person Type",
      "Status",
      "Department",
      "Designation",
      "Reporting Manager",
      "Joining Date",
      "Exit Date",
      "Exit Reason",
    ];
    const rows = all.map((p) => [
      p.firstName,
      p.middleName || "",
      p.lastName,
      p.email,
      p.phone || "",
      p.altPhone || "",
      p.gender || "",
      p.dob ? new Date(p.dob).toISOString().split("T")[0] : "",
      p.personType,
      p.status,
      p.department?.name || "",
      p.designation?.name || "",
      p.manager ? fullName(p.manager) : "",
      p.joiningDate ? new Date(p.joiningDate).toLocaleDateString() : "",
      p.exitDate ? new Date(p.exitDate).toLocaleDateString() : "",
      p.exitReason || "",
    ]);
    exportToExcel("Staff_Directory_Export", headers, rows);
    toast.success("Staff directory exported", `${rows.length} records downloaded.`);
  };

  const resetBulkImport = () => {
    setBulkFileName("");
    setBulkParsedRows([]);
    setBulkRowErrors([]);
  };

  const BULK_HEADERS = [
    "firstName",
    "middleName",
    "lastName",
    "email",
    "phone",
    "altPhone",
    "gender",
    "dob",
    "personType",
    "departmentName",
    "designationName",
    "joiningDate",
    ...(canSetSalary ? ["monthlyGross"] : []),
  ];

  const handleDownloadTemplate = () => {
    const sampleRows = [
      ["Pooja", "Kumar", "Sharma", "pooja.sharma@example.org", "+91 9876543210", "", "FEMALE", "1992-05-14", "EMPLOYEE", "Programmes", "Project Coordinator", "2026-02-01", ...(canSetSalary ? [45000] : [])],
      ["Amit", "", "Verma", "amit.verma@example.org", "+91 9812345678", "+91 9812345679", "MALE", "1995-11-02", "VOLUNTEER", "Field Operations", "Field Volunteer", "2026-03-15", ...(canSetSalary ? [""] : [])],
    ];
    exportToExcel("staff_import_template", BULK_HEADERS, sampleRows, "Staff")
      .then(() => toast.success("Template downloaded", "Fill in your staff details and upload the file."))
      .catch((err) => toast.error("Download failed", formatErrorMessage(err)));
  };

  const cellToText = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    if (typeof value === "object") {
      const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
      if (v.richText) return v.richText.map((r) => r.text).join("").trim();
      if (v.text !== undefined) return String(v.text).trim();
      if (v.result !== undefined) return cellToText(v.result);
    }
    return String(value).trim();
  };

  const handleParseExcel = async (file: File) => {
    resetBulkImport();
    setBulkFileName(file.name);
    setBulkParsing(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("empty");

      const headers: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col] = cellToText(cell.value).toLowerCase().replace(/[\s_]/g, "");
      });

      const valid: any[] = [];
      const errors: { row: number; reason: string }[] = [];
      const seenEmails = new Set<string>();

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const r: Record<string, string> = {};
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          if (headers[col]) r[headers[col]] = cellToText(cell.value);
        });
        if (Object.values(r).every((v) => !v)) return;

        const record = {
          firstName: r.firstname || "",
          middleName: r.middlename || undefined,
          lastName: r.lastname || "",
          email: (r.email || "").toLowerCase(),
          phone: r.phone || "",
          altPhone: r.altphone || undefined,
          gender: normalizeGender(r.gender),
          dob: r.dob || r.dateofbirth || "",
          personType: (r.persontype || "EMPLOYEE").toUpperCase() === "VOLUNTEER" ? "VOLUNTEER" : "EMPLOYEE",
          departmentName: r.departmentname || r.department || "",
          designationName: r.designationname || r.designation || "",
          joiningDate: r.joiningdate || new Date().toISOString().split("T")[0],
        };

        const problems: string[] = [];
        const salaryRaw = canSetSalary
          ? (r.monthlygross || r.monthlysalary || r.salary || "").replace(/[₹,\s]/g, "")
          : "";
        let monthlyGross: number | undefined;
        if (salaryRaw) {
          monthlyGross = Number(salaryRaw);
          if (!Number.isFinite(monthlyGross) || monthlyGross < 0.01) {
            problems.push("monthly salary is invalid");
            monthlyGross = undefined;
          }
        }
        if (!record.firstName) problems.push("first name is required");
        if (!record.lastName) problems.push("last name is required");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) problems.push("email is invalid");
        else if (seenEmails.has(record.email)) problems.push("email appears twice in the file");
        if (!PHONE_REGEX.test(record.phone)) problems.push("phone is missing or invalid");
        if (record.altPhone && !PHONE_REGEX.test(record.altPhone)) problems.push("alternate mobile is invalid");
        if (!record.gender) problems.push("gender must be MALE, FEMALE or OTHER");
        if (!record.dob || Number.isNaN(Date.parse(record.dob))) problems.push("date of birth is missing or invalid");
        else if (new Date(record.dob) > new Date()) problems.push("date of birth cannot be in the future");

        if (problems.length > 0) {
          errors.push({ row: rowNumber, reason: problems.join(", ") });
        } else {
          seenEmails.add(record.email);
          valid.push(monthlyGross !== undefined ? { ...record, monthlyGross } : record);
        }
      });

      if (valid.length > 500) {
        toast.error("Too many rows", "Please import at most 500 staff members per file.");
        return;
      }
      setBulkParsedRows(valid);
      setBulkRowErrors(errors);
      if (valid.length === 0 && errors.length === 0) {
        toast.error("No staff found", "The file has no data rows. Use the Excel template.");
      }
    } catch {
      toast.error("Could not read file", "Please upload a valid Excel (.xlsx) file based on the template.");
    } finally {
      setBulkParsing(false);
    }
  };

  // Mutations
  const createPerson = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<Person & { inviteSent?: boolean; message?: string; salaryNote?: string }>("/hr/persons", payload),
    onSuccess: (p) => {
      setCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      toast.success(
        `${p.personType === "VOLUNTEER" ? "Volunteer" : "Employee"} onboarded`,
        `${fullName(p)} added successfully.`,
      );
      if (p.inviteSent === false && p.message) toast.info("Invitation not sent", p.message);
      if (p.salaryNote) toast.info("Salary not set", p.salaryNote);
    },
    onError: (err) => {
      toast.error("Failed to add person", formatErrorMessage(err));
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
      toast.success("Resignation recorded", "Status set to Notice Period. Complete the exit checklist to close the record.");
    },
    onError: (err) => {
      toast.error("Failed to process exit", formatErrorMessage(err));
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

  const reviewDoc = useMutation({
    mutationFn: ({ docId, status, rejectionReason }: { docId: string; status: "APPROVED" | "REJECTED"; rejectionReason?: string }) =>
      api.patch(`/hr/persons/${selectedPersonId}/documents/${docId}/review`, { status, rejectionReason }),
    onSuccess: (_, vars) => {
      refetchSelectedPerson();
      toast.success(
        vars.status === "APPROVED" ? "Document Approved" : "Document Rejected",
        vars.status === "APPROVED"
          ? "KYC document verified and locked."
          : "Document marked as rejected with reason.",
      );
    },
    onError: (err: any) => {
      toast.error("Review failed", err.message || "Failed to update document status.");
    },
  });

  const handleOpenEditModal = (_p: Person) => {
    setEditModalOpen(true);
  };

  const updatePersonMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/hr/persons/${selectedPersonId}`, payload),
    onSuccess: () => {
      setEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      refetchSelectedPerson();
      toast.success("Profile updated", "The profile details were saved.");
    },
    onError: (err: any) => {
      toast.error("Update failed", formatErrorMessage(err));
    },
  });


  const handleOpenDocViewer = async (doc: PersonDocument) => {
    setPreviewDoc(doc);
    setPreviewDocUrl(null);
    setPreviewDocError(null);
    setLoadingPreview(true);
    setViewDocModalOpen(true);
    try {
      const data = await api.get<{ downloadUrl?: string; url?: string }>(
        `/hr/persons/${selectedPersonId}/documents/${doc.id}/url`
      );
      const targetUrl = data.url || data.downloadUrl || null;
      if (!targetUrl) {
        setPreviewDocError("Document link is not available in storage.");
      } else {
        setPreviewDocUrl(targetUrl);
      }
    } catch (err: any) {
      setPreviewDocError("Could not open this document. Please re-upload if needed.");
      toast.error("Preview failed", "Could not generate preview link.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUploadDocument = async () => {
    const isKyc = docCategory === "KYC";
    const finalName = isKyc && docIdType !== OTHER_ID_TYPE ? docIdType : docName.trim();
    if (!selectedPersonId || !selectedFile || !finalName) return;

    if (docCategory === "KYC" && !docNumber.trim()) {
      toast.error("Document Number required", "Please enter the document / ID number for KYC verification.");
      return;
    }

    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", finalName);
      formData.append("category", docCategory);
      if (docCategory === "KYC" && docNumber.trim()) {
        formData.append("documentNumber", docNumber.trim());
      }

      await api.upload(`/hr/persons/${selectedPersonId}/documents`, formData);

      setDocName("");
      setDocIdType("");
      setDocNumber("");
      setSelectedFile(null);
      setShowUploadForm(false);
      refetchSelectedPerson();
      toast.success("Document uploaded", "File uploaded securely.");
    } catch (err: any) {
      toast.error("Upload failed", err.message || "Could not upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDoc = async (docId: string, docName: string) => {
    try {
      const data = await api.get<{ url?: string; downloadUrl?: string }>(
        `/hr/persons/${selectedPersonId}/documents/${docId}/url`,
      );
      const targetUrl = data?.downloadUrl || data?.url;
      if (targetUrl) {
        const link = document.createElement("a");
        link.href = targetUrl;
        link.download = docName || "document";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast.error("Download failed", "Download URL could not be generated.");
      }
    } catch (err: any) {
      toast.error("Download failed", err.message || "Could not generate download link.");
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6">
      <PageHeader
        icon={Users}
        title="Person Master"
        description="Manage employee and volunteer profiles, reporting hierarchies, and records."
        badge={{ label: `${totalPeople} Staff`, variant: "secondary" }}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportStaffDirectory}
              className="gap-1 font-semibold rounded-xl text-xs h-8 px-2 sm:px-3"
              title="Export Staff Directory (Excel)"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetBulkImport();
                  setBulkParsedRows([]);
                  setBulkImportModalOpen(true);
                }}
                className="gap-1 font-semibold rounded-xl text-xs h-8 px-2 sm:px-3"
                title="Bulk Import Staff (Excel)"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bulk Import</span>
              </Button>
            )}
            <Button
              onClick={() => setCreateModalOpen(true)}
              size="sm"
              className="gap-1.5 font-bold rounded-xl text-xs h-8 px-3 shadow-sm bg-primary text-primary-foreground shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>New Person</span>
            </Button>
          </div>
        }
        stats={[
          { label: "All Staff", value: totalAllStaff },
          {
            label: "Employees",
            value: counts?.employees ?? 0,
            color: "text-primary",
          },
          {
            label: "Volunteers",
            value: counts?.volunteers ?? 0,
            color: "text-amber-500",
          },
          {
            label: "Active",
            value: counts?.active ?? 0,
            color: "text-emerald-500",
          },
        ]}
      />

      {/* Filters and Search Bar */}
      <Card className="rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
        <CardContent className="p-2.5 sm:p-4 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          {/* Mobile: Search first for instant query */}
          <SearchInput
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:hidden"
          />

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto">
            <div className="flex items-center gap-1 shrink-0">
              {(["ALL", "EMPLOYEE", "VOLUNTEER"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPersonTypeFilter(t)}
                  className={cn(
                    "h-8 text-xs font-semibold px-3 rounded-xl transition-all cursor-pointer shrink-0 border",
                    personTypeFilter === t
                      ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                      : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "ALL" ? "All Staff" : t === "EMPLOYEE" ? "Employees" : "Volunteers"}
                </button>
              ))}
            </div>

            <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0" />

            {/* Department HR Scope Filter */}
            <div className="w-36 sm:w-48 shrink-0">
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                size="sm"
                placeholder="All Depts"
              >
                <option value="ALL">All Depts</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            {myDepartmentId && (
              <button
                type="button"
                onClick={() =>
                  setDepartmentFilter(departmentFilter === myDepartmentId ? "ALL" : myDepartmentId)
                }
                className={cn(
                  "h-8 text-xs font-semibold px-2.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border",
                  departmentFilter === myDepartmentId
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border-transparent text-muted-foreground hover:text-foreground"
                )}
                title="Filter to my assigned department"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>My Dept</span>
              </button>
            )}
          </div>

          {/* Desktop Search Box */}
          <SearchInput
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64 hidden sm:flex shrink-0"
          />
        </CardContent>
      </Card>

      {/* Department HR Mode Active Banner */}
      {departmentFilter !== "ALL" && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/20 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground">
              Department HR Mode:{" "}
              {departments?.find((d) => d.id === departmentFilter)?.name || "Selected Department"}
            </span>
            <span className="text-muted-foreground hidden sm:inline">
              • Focused scope for task escalation, attendance, and approvals ({totalPeople} members)
            </span>
          </div>
          <button
            onClick={() => setDepartmentFilter("ALL")}
            className="text-primary hover:underline text-xs font-semibold cursor-pointer"
          >
            Reset to All
          </button>
        </div>
      )}

      {/* People Table & Mobile Cards */}
      <Card className="rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
        <CardContent className="p-0">
          <QueryState isLoading={false} error={error}>
            {/* Mobile Native Card View (Phones < 640px) */}
            <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {isFetchingFirst ? (
                <MobileSkeleton />
              ) : paginatedPeople.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No staff records found matching your filters.
                </div>
              ) : (
                paginatedPeople.map((p) => <PersonCard key={p.id} p={p} onSelect={setSelectedPersonId} />)
              )}
            </div>

            {/* Desktop Table View (Tablets & Desktops >= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
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
                  {isFetchingFirst ? (
                    <PeopleSkeletonRows />
                  ) : paginatedPeople.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                        No records found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPeople.map((p) => <PersonRow key={p.id} p={p} onSelect={setSelectedPersonId} />)
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={peopleQuery.page}
              totalPages={peopleQuery.totalPages}
              totalItems={peopleQuery.total}
              pageSize={peopleQuery.pageSize}
              onPageChange={peopleQuery.setPage}
              onPageSizeChange={peopleQuery.setPageSize}
            />
          </QueryState>
        </CardContent>
      </Card>

      {/* New Person Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Onboard New Person"
        description="Add a staff member or volunteer to your organisation."
        maxWidth="4xl"
      >
        {createModalOpen && (
          <PersonForm
            mode="create"
            departments={departments}
            designations={designations}
            managers={people}
            isSubmitting={createPerson.isPending}
            submitLabel="Onboard person"
            onCancel={() => setCreateModalOpen(false)}
            onSubmit={(payload) => createPerson.mutate(payload)}
          />
        )}
      </Modal>

      {/* Person Detail Drawer with Sticky Rich Header */}
      <Drawer
        isOpen={!!selectedPersonId}
        onClose={() => setSelectedPersonId(null)}
        width="xl"
        headerContent={
          selectedPerson ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={fullName(selectedPerson)}
                    src={selectedPerson.avatarUrl || undefined}
                    size="lg"
                    isBordered
                    status={selectedPerson.status === "ACTIVE" ? "online" : undefined}
                    className="h-12 w-12 text-sm shadow-xs shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-foreground text-base truncate">
                        {fullName(selectedPerson)}
                      </h4>
                      <Badge
                        variant={selectedPerson.personType === "EMPLOYEE" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {selectedPerson.personType === "EMPLOYEE" ? "Employee" : "Volunteer"}
                      </Badge>
                      <Badge
                        variant={
                          selectedPerson.status === "ACTIVE"
                            ? "success"
                            : selectedPerson.status === "NOTICE_PERIOD"
                              ? "warning"
                              : "secondary"
                        }
                        dot
                        className="text-[10px]"
                      >
                        {selectedPerson.status === "NOTICE_PERIOD" ? "Notice Period" : selectedPerson.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{selectedPerson.email}</p>
                    <p className="text-xs font-semibold text-primary mt-0.5 truncate">
                      {selectedPerson.designation?.name || "Staff Member"}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEditModal(selectedPerson)}
                    className="shrink-0 gap-1.5 text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/10 h-8 px-2.5 sm:px-3"
                    title="Edit profile details, department, designation, and reporting manager"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Edit Profile & Reporting</span>
                    <span className="sm:hidden font-medium">Edit</span>
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {!selectedPerson && selectedPersonLoading && (
          <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading profile">
            <div className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
            <div className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-32 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          </div>
        )}
        {!selectedPerson && !selectedPersonLoading && (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">
              {selectedPersonError ? formatErrorMessage(selectedPersonError) : "The requested item could not be found."}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchSelectedPerson()}>
              Try again
            </Button>
          </div>
        )}
        {selectedPerson && (
          <div className="space-y-4">
            {/* Meta Grid (Scrolls naturally on mobile) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 min-w-0">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                  <Building className="h-3 w-3 text-primary shrink-0" /> Dept
                </span>
                <p className="font-semibold text-foreground truncate mt-0.5 text-xs">
                  {selectedPerson.department?.name || "Not assigned"}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 min-w-0">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                  <UserCheck className="h-3 w-3 text-emerald-500 shrink-0" /> Manager
                </span>
                {selectedPerson.manager ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPersonId(selectedPerson.manager!.id)}
                    className="font-semibold text-primary hover:underline truncate mt-0.5 text-xs block text-left w-full group cursor-pointer"
                    title="Click to view supervisor profile"
                  >
                    <span className="truncate block">
                      {fullName(selectedPerson.manager)}
                    </span>
                    {selectedPerson.manager.designation?.name && (
                      <span className="text-[10px] text-muted-foreground font-normal truncate block">
                        {selectedPerson.manager.designation.name}
                      </span>
                    )}
                  </button>
                ) : (
                  <p className="font-semibold text-foreground truncate mt-0.5 text-xs">
                    None (Top Level)
                  </p>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 min-w-0">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                  <Phone className="h-3 w-3 text-muted-foreground shrink-0" /> Contact
                </span>
                <p className="font-semibold text-foreground truncate font-mono mt-0.5 text-xs">
                  {selectedPerson.phone || "Not recorded"}
                </p>
                {selectedPerson.altPhone && (
                  <p className="text-[11px] text-muted-foreground truncate font-mono" title="Alternate mobile number">
                    Alt: {selectedPerson.altPhone}
                  </p>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 min-w-0">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                  <Calendar className="h-3 w-3 text-muted-foreground shrink-0" /> Joined
                </span>
                <p className="font-semibold text-foreground truncate mt-0.5 text-xs">
                  {selectedPerson.joiningDate
                    ? new Date(selectedPerson.joiningDate).toLocaleDateString()
                    : "Not recorded"}
                </p>
              </div>
            </div>
            {canManage && (!selectedPerson.phone || !selectedPerson.gender || !selectedPerson.dob) && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Phone number, gender or date of birth is missing. Use Edit to complete this profile.</span>
              </div>
            )}

            {/* Address & Emergency Contact Summary */}
            {(selectedPerson.currentAddress || selectedPerson.permanentAddress || selectedPerson.address || selectedPerson.emergencyContact) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {(selectedPerson.currentAddress || selectedPerson.address) && (
                  <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <span className="text-muted-foreground font-medium block mb-1">Current Residential Address</span>
                    <p className="text-foreground">{selectedPerson.currentAddress || selectedPerson.address}</p>
                  </div>
                )}
                {selectedPerson.permanentAddress && (
                  <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <span className="text-muted-foreground font-medium block mb-1">Permanent Address</span>
                    <p className="text-foreground">{selectedPerson.permanentAddress}</p>
                  </div>
                )}
                {selectedPerson.emergencyContact && (
                  <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <span className="text-muted-foreground font-medium flex items-center gap-1 mb-1">
                      <HeartHandshake className="h-3 w-3 text-primary" /> Emergency Contact
                    </span>
                    <p className="text-foreground font-mono">{selectedPerson.emergencyContact}</p>
                  </div>
                )}
              </div>
            )}

            {/* Direct Reports Section (if any) */}
            {selectedPerson.directReports && selectedPerson.directReports.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5 text-primary" />
                    Direct Reports ({selectedPerson.directReports.length})
                  </h5>
                  <span className="text-[11px] text-muted-foreground">Click member to view profile</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedPerson.directReports.map((dr) => (
                    <button
                      type="button"
                      key={dr.id}
                      onClick={() => setSelectedPersonId(dr.id)}
                      className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center justify-between text-left transition-colors cursor-pointer group"
                      title="Click to view profile"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors block truncate">
                          {fullName(dr)}
                        </span>
                        {dr.designation?.name && (
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {dr.designation.name}
                          </span>
                        )}
                      </div>
                      <Badge size="sm" variant="secondary" className="shrink-0 ml-2">
                        {dr.personType === "EMPLOYEE" ? "Employee" : "Volunteer"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Documents Section */}
            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Documents & KYC ({selectedPerson.documents?.length || 0})
                  </h5>
                  <p className="text-[11px] text-muted-foreground">Stored securely</p>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    variant={showUploadForm ? "ghost" : "outline"}
                    onClick={() => setShowUploadForm(!showUploadForm)}
                    className="h-7 text-xs px-2.5 gap-1.5 rounded-lg border-primary/20 text-primary hover:bg-primary/10"
                  >
                    {showUploadForm ? (
                      <>
                        <X className="h-3.5 w-3.5" />
                        <span>Cancel</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Document</span>
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Upload Form with Asset Drag & Drop */}
              {showUploadForm && (
                <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3 animate-in fade-in-50 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Select
                      label="Category"
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as any)}
                      className="h-9 text-xs"
                    >
                      <option value="KYC">KYC Document</option>
                      <option value="RESUME">Resume / CV</option>
                      <option value="JOINING_LETTER">Joining Letter</option>
                      <option value="CONTRACT">Contract / Agreement</option>
                      <option value="OTHER">Other Record</option>
                    </Select>
                    {docCategory === "KYC" ? (
                      <Select
                        label="Document Type *"
                        value={docIdType}
                        onChange={(e) => setDocIdType(e.target.value)}
                        className="h-9 text-xs"
                      >
                        <option value="">Select ID type</option>
                        {KYC_ID_TYPES.map((t) => (
                          <option key={t.label} value={t.label}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-1">
                        Document Title *
                      </label>
                      <Input
                        placeholder="e.g. Offer Letter / Resume"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        maxLength={INPUT_LIMITS.DOC_TITLE_MAX}
                        className="h-9 text-xs"
                      />
                    </div>
                    )}
                  </div>

                  {docCategory === "KYC" && docIdType === OTHER_ID_TYPE && (
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-1">
                        Document Name *
                      </label>
                      <Input
                        placeholder="e.g. Ration Card"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        maxLength={INPUT_LIMITS.DOC_TITLE_MAX}
                        className="h-9 text-xs"
                      />
                    </div>
                  )}

                  {docCategory === "KYC" && (
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-1">
                        {docIdType && docIdType !== OTHER_ID_TYPE ? `${docIdType} Number *` : "ID Number *"}
                      </label>
                      <Input
                        placeholder={kycHint(docIdType)}
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        maxLength={INPUT_LIMITS.DOC_NUMBER_MAX}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                  )}

                  {/* Asset Drag & Drop Zone */}
                  <FileDropzone
                    file={selectedFile}
                    onFileSelect={(f) => {
                      setSelectedFile(f);
                      if (f && !docName.trim()) {
                        setDocName(f.name.replace(/\.[^/.]+$/, ""));
                      }
                    }}
                    disabled={uploadingDoc}
                  />

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={handleUploadDocument}
                      disabled={!selectedFile || (docCategory === "KYC" ? !docIdType || (docIdType === OTHER_ID_TYPE && !docName.trim()) || !docNumber.trim() : !docName.trim()) || uploadingDoc}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingDoc ? "Uploading…" : "Upload Document"}</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Uploaded Documents List */}
              <div className="space-y-2">
                {selectedPerson.documents?.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No documents uploaded for this person yet.
                  </p>
                ) : (
                  selectedPerson.documents?.map((doc) => {
                    const bytes = doc.sizeBytes ?? doc.fileSize ?? 0;
                    const dateRaw = doc.uploadedAt || doc.createdAt;
                    const dateObj = dateRaw ? new Date(dateRaw) : null;
                    const formattedDate = dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                      : "Recently uploaded";

                    const isApproved = doc.status === "APPROVED";
                    const isRejected = doc.status === "REJECTED";
                    const isPending = doc.status === "PENDING" || !doc.status;

                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "p-3 rounded-xl border text-xs transition-all flex flex-col gap-2",
                          isApproved && "border-emerald-500/30 bg-emerald-500/5",
                          isRejected && "border-red-500/30 bg-red-500/5",
                          isPending && "border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900",
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-foreground text-xs sm:text-sm">{doc.name}</p>
                                {isApproved && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle className="h-3 w-3" /> Verified
                                  </span>
                                )}
                                {isPending && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                    <Clock className="h-3 w-3" /> Pending Review
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-700 dark:text-red-300">
                                    <XCircle className="h-3 w-3" /> Rejected
                                  </span>
                                )}
                              </div>

                              {doc.documentNumber && (
                                <p className="text-[11px] font-mono text-foreground font-semibold mt-1">
                                  ID: <span className="text-primary">{doc.documentNumber}</span>
                                </p>
                              )}

                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 flex-wrap">
                                <Badge size="sm" variant="secondary">
                                  {doc.category}
                                </Badge>
                                <span>{formatFileSize(bytes)}</span>
                                <span>•</span>
                                <span>{formattedDate}</span>
                              </div>

                              {isRejected && doc.rejectionReason && (
                                <div className="mt-2 p-2 rounded-lg bg-red-500/10 text-[10px] text-red-600 dark:text-red-400 font-medium leading-relaxed">
                                  <strong>HR Note:</strong> {doc.rejectionReason}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/80 shrink-0 flex-wrap">
                            {/* In-App View Document Button */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenDocViewer(doc)}
                              className="h-7 sm:h-8 px-2.5 gap-1 text-xs text-primary hover:bg-primary/10 border-primary/20"
                              title="View document inside app"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </Button>

                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(doc.id, doc.name)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Download document file"
                            >
                              <Download className="h-4 w-4" />
                            </button>

                            {/* HR Approval / Rejection Controls for Any Document */}
                            {canManage && (
                              <>
                                {!isApproved && (
                                  <button
                                    type="button"
                                    onClick={() => reviewDoc.mutate({ docId: doc.id, status: "APPROVED" })}
                                    disabled={reviewDoc.isPending}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors text-[11px] font-semibold"
                                    title="Approve document"
                                  >
                                    Approve
                                  </button>
                                )}
                                {!isRejected && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectDocId(doc.id);
                                      setRejectModalOpen(true);
                                    }}
                                    disabled={reviewDoc.isPending}
                                    className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-colors text-[11px] font-semibold"
                                    title="Reject document with reason"
                                  >
                                    Reject
                                  </button>
                                )}
                              </>
                            )}

                            {!isApproved && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Delete ${doc.name}?`,
                                    description: "This document will be permanently removed.",
                                    confirmLabel: "Delete",
                                  });
                                  if (ok) deleteDoc.mutate({ docId: doc.id });
                                }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                title="Delete document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Resignation / Exit Clearance Section */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h6 className="text-xs font-semibold text-foreground">Offboarding & Exit Clearance</h6>
                  <p className="text-[11px] text-muted-foreground">Handover tracking, asset return, and record closure.</p>
                </div>
                {selectedPerson.status !== "EXITED" && selectedPerson.status !== "NOTICE_PERIOD" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExitModalOpen(true)}
                    className="gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Process Resignation
                  </Button>
                )}
              </div>

              {(selectedPerson.status === "NOTICE_PERIOD" || selectedPerson.status === "EXITED") &&
                me?.permissionKeys?.includes("payroll.run.read") && <FinalSettlementCard personId={selectedPerson.id} />}

              {(selectedPerson.status === "NOTICE_PERIOD" || selectedPerson.status === "EXITED" || selectedPerson.exitChecklist) && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Exit Clearance Checklist</span>
                    {selectedPerson.exitChecklist?.completedAt && (
                      <Badge variant="success" size="sm" dot>
                        Clearance Completed
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assetReturn}
                        onChange={(e) => setAssetReturn(e.target.checked)}
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Physical Assets (Laptop, Keys, etc.)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={idCardReturn}
                        onChange={(e) => setIdCardReturn(e.target.checked)}
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Staff ID Card & Access Badge</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={knowledgeHandover}
                        onChange={(e) => setKnowledgeHandover(e.target.checked)}
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Knowledge & Project Handover</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={financeClearance}
                        onChange={(e) => setFinanceClearance(e.target.checked)}
                        className="rounded text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Finance & Expense Claims Clearance</span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Handover & Clearance Notes</label>
                    <Input
                      placeholder="e.g. Handover file transferred to Anita, all keys handed over to admin."
                      value={exitClearanceNotes}
                      onChange={(e) => setExitClearanceNotes(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  {canManage && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateExitChecklist.mutate({
                            personId: selectedPerson.id,
                            checklist: {
                              assetReturn,
                              idCardReturn,
                              knowledgeHandover,
                              financeClearance,
                              notes: exitClearanceNotes,
                            },
                          })
                        }
                        disabled={updateExitChecklist.isPending}
                        className="text-xs h-8"
                      >
                        Save Checklist
                      </Button>

                      {selectedPerson.status !== "EXITED" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setFinalizeExitDate(new Date().toISOString().slice(0, 10));
                            setFinalizeReason(selectedPerson.exitReason || "");
                            setFinalizeReassignTo("");
                            setFinalizeModalOpen(true);
                          }}
                          disabled={updateExitChecklist.isPending}
                          className="text-xs h-8 font-bold"
                        >
                          Finalize Exit Closure
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit profile"
        description="Update personal details, work placement and who this person reports to."
        maxWidth="4xl"
      >
        {editModalOpen && selectedPerson && (
          <PersonForm
            key={selectedPerson.id}
            mode="edit"
            person={selectedPerson}
            departments={departments}
            designations={designations}
            managers={people}
            isSubmitting={updatePersonMutation.isPending}
            onCancel={() => setEditModalOpen(false)}
            onSubmit={(payload) => updatePersonMutation.mutate(payload)}
          />
        )}
      </Modal>


      {/* In-App Document Viewer & Review Modal */}
      <Modal
        isOpen={viewDocModalOpen}
        onClose={() => {
          setViewDocModalOpen(false);
          setPreviewDoc(null);
          setPreviewDocUrl(null);
          setPreviewDocError(null);
        }}
        title={previewDoc ? previewDoc.name : "Document Viewer"}
        description={
          previewDoc
            ? `${previewDoc.category} Document ${previewDoc.documentNumber ? `• ID: ${previewDoc.documentNumber}` : ""} • Uploaded on ${previewDoc.uploadedAt ? new Date(previewDoc.uploadedAt).toLocaleDateString() : "Recent"}`
            : undefined
        }
        maxWidth="xl"
      >
        <div className="space-y-4">
          {/* Status pill & metadata header */}
          {previewDoc && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 text-xs">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    previewDoc.status === "APPROVED"
                      ? "success"
                      : previewDoc.status === "REJECTED"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {previewDoc.status === "APPROVED"
                    ? "✓ Verified by HR"
                    : previewDoc.status === "REJECTED"
                      ? "✕ Rejected"
                      : "⏳ Verification Pending"}
                </Badge>
                {previewDoc.documentNumber && (
                  <span className="font-mono font-semibold text-primary">
                    ID: {previewDoc.documentNumber}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadDoc(previewDoc.id, previewDoc.name)}
                  className="h-7 text-xs gap-1"
                >
                  <Download className="h-3 w-3" />
                  <span>Download</span>
                </Button>
                {previewDocUrl && (
                  <a
                    href={previewDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors"
                    title="Open in new window"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Rejection Notice if rejected */}
          {previewDoc?.status === "REJECTED" && previewDoc.rejectionReason && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
              <strong>HR Rejection Feedback:</strong> {previewDoc.rejectionReason}
            </div>
          )}

          {/* Document Content Viewport */}
          <div className="min-h-[50vh] max-h-[65vh] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950/10 dark:bg-zinc-950/40 overflow-hidden flex items-center justify-center relative">
            {loadingPreview ? (
              <div className="p-8 text-center space-y-2">
                <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground">Loading document preview…</p>
              </div>
            ) : previewDocError ? (
              <div className="p-8 text-center space-y-3 max-w-sm mx-auto">
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                <div>
                  <h6 className="font-bold text-foreground text-sm">Preview Unavailable</h6>
                  <p className="text-xs text-muted-foreground mt-1">{previewDocError}</p>
                </div>
              </div>
            ) : previewDocUrl ? (
              previewDoc?.mimeType?.includes("image") ||
              previewDoc?.name?.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                <img
                  src={previewDocUrl}
                  alt={previewDoc?.name}
                  className="max-h-[62vh] max-w-full rounded-xl object-contain shadow-md"
                />
              ) : (
                <iframe
                  src={previewDocUrl}
                  title={previewDoc?.name}
                  className="w-full h-[62vh] rounded-2xl bg-white border-0"
                />
              )
            ) : (
              <div className="p-8 text-center space-y-2">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                <p className="text-xs text-muted-foreground">Unable to render document preview.</p>
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          {canManage && previewDoc && (
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-xs text-muted-foreground">
                Take HR verification action on this document:
              </div>
              <div className="flex items-center gap-2">
                {previewDoc.status !== "REJECTED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectDocId(previewDoc.id);
                      setRejectModalOpen(true);
                      setViewDocModalOpen(false);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-500/30 text-xs gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </Button>
                )}

                {previewDoc.status !== "APPROVED" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      reviewDoc.mutate({ docId: previewDoc.id, status: "APPROVED" });
                      setViewDocModalOpen(false);
                    }}
                    disabled={reviewDoc.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>{reviewDoc.isPending ? "Approving…" : "Approve & Lock"}</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

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

      {/* Finalize Exit Closure Modal */}
      <Modal
        isOpen={finalizeModalOpen}
        onClose={() => setFinalizeModalOpen(false)}
        title="Finalize Exit Closure"
        description="This marks the record as exited, cancels pending leave and deactivates the login. All four checklist items must be complete."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedPerson) return;
            updateExitChecklist.mutate({
              personId: selectedPerson.id,
              checklist: { assetReturn, idCardReturn, knowledgeHandover, financeClearance, notes: exitClearanceNotes },
              isFinalized: true,
              exitDate: finalizeExitDate,
              exitReason: finalizeReason.trim(),
              reassignReportsTo: finalizeReassignTo,
            });
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Effective Exit Date *</label>
            <Input type="date" value={finalizeExitDate} onChange={(e) => setFinalizeExitDate(e.target.value)} required />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Reason for Leaving *</label>
            <Input
              placeholder="e.g. Relocated / Better opportunity / Contract completed"
              value={finalizeReason}
              onChange={(e) => setFinalizeReason(e.target.value)}
              required
            />
          </div>

          <Select
            label="Hand over direct reports to (optional)"
            value={finalizeReassignTo}
            onChange={(e) => setFinalizeReassignTo(e.target.value)}
          >
            <option value="">No one (reports will have no manager)</option>
            {(people || [])
              .filter((p) => p.id !== selectedPerson?.id && p.status !== "EXITED")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                </option>
              ))}
          </Select>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setFinalizeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!finalizeExitDate || !finalizeReason.trim() || updateExitChecklist.isPending}
            >
              {updateExitChecklist.isPending ? "Processing…" : "Finalize & Close"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject KYC Document Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectDocId(null);
          setRejectReason("");
        }}
        title="Reject KYC Document"
        description="Please provide a clear reason for rejecting this document so the user can re-upload."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (rejectDocId) {
              reviewDoc.mutate({
                docId: rejectDocId,
                status: "REJECTED",
                rejectionReason: rejectReason.trim() || "Document does not meet verification guidelines",
              });
              setRejectModalOpen(false);
              setRejectDocId(null);
              setRejectReason("");
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Rejection Reason *</label>
            <Input
              placeholder="e.g. Blurry photograph / expiry date not visible / invalid document"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectDocId(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!rejectReason.trim() || reviewDoc.isPending}>
              {reviewDoc.isPending ? "Rejecting…" : "Confirm Rejection"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Staff & Volunteer Import Modal */}
      <Modal
        isOpen={bulkImportModalOpen}
        onClose={() => {
          setBulkImportModalOpen(false);
          resetBulkImport();
        }}
        maxWidth="4xl"
        title="Bulk Staff & Volunteer Onboarding"
        description="Upload an Excel file to create many staff and volunteer profiles at once."
      >
        <div className="space-y-4 pt-2">
          {/* Step 1: Download Template */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs">
            <div>
              <p className="font-semibold text-foreground">Start from the Excel template</p>
              <p className="text-[11px] text-muted-foreground">
                Required: first name, last name, email, phone, gender (MALE / FEMALE / OTHER), date of birth (YYYY-MM-DD).
                {canSetSalary
                  ? " Optional: monthlyGross (monthly salary, employees only)."
                  : " Salary columns are ignored: you do not have permission to set salaries."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-1.5 shrink-0 border-primary/30 text-primary font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Excel Template</span>
            </Button>
          </div>

          {/* Step 2: Upload Excel */}
          <label className="flex flex-col items-center justify-center gap-1.5 p-6 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 bg-background cursor-pointer transition-colors text-center">
            <Upload className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {bulkParsing ? "Reading file…" : bulkFileName || "Choose an Excel file (.xlsx)"}
            </span>
            <span className="text-[11px] text-muted-foreground">Up to 500 staff members per file</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleParseExcel(file);
                e.target.value = "";
              }}
            />
          </label>

          {/* Rows that need fixing */}
          {bulkRowErrors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-destructive">
                {bulkRowErrors.length} row{bulkRowErrors.length === 1 ? "" : "s"} need fixing before import
              </p>
              <ul className="max-h-32 overflow-y-auto rounded-xl border border-destructive/30 bg-destructive/5 divide-y divide-destructive/10 text-[11px]">
                {bulkRowErrors.map((e, i) => (
                  <li key={i} className="px-2.5 py-1.5">
                    <span className="font-semibold">Row {e.row}:</span> {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview of valid rows */}
          {bulkParsedRows.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground">
                Ready to import: <strong className="text-primary">{bulkParsedRows.length}</strong> staff members
              </span>
              <div className="max-h-60 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-1.5">Name</th>
                      <th className="p-1.5">Email</th>
                      <th className="p-1.5">Phone</th>
                      <th className="p-1.5">Gender</th>
                      <th className="p-1.5">Date of Birth</th>
                      <th className="p-1.5">Type</th>
                      <th className="p-1.5">Department</th>
                      {bulkParsedRows.some((r) => r.monthlyGross !== undefined) && <th className="p-1.5">Salary</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {bulkParsedRows.map((r, i) => (
                      <tr key={i}>
                        <td className="p-1.5 font-medium">{fullName(r)}</td>
                        <td className="p-1.5 font-mono text-muted-foreground">{r.email}</td>
                        <td className="p-1.5 font-mono">{r.phone}</td>
                        <td className="p-1.5">{r.gender}</td>
                        <td className="p-1.5 font-mono">{r.dob}</td>
                        <td className="p-1.5"><Badge size="sm" variant="outline">{r.personType}</Badge></td>
                        <td className="p-1.5">{r.departmentName || "—"}</td>
                        {bulkParsedRows.some((x) => x.monthlyGross !== undefined) && (
                          <td className="p-1.5 font-mono">{r.monthlyGross !== undefined ? `₹${Number(r.monthlyGross).toLocaleString("en-IN")}` : "—"}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={bulkSendInvites}
              onChange={(e) => setBulkSendInvites(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Send login invitations by email
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkImportModalOpen(false);
                resetBulkImport();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => bulkImport.mutate(bulkParsedRows)}
              disabled={bulkParsedRows.length === 0 || bulkImport.isPending || bulkParsing}
              className="gap-2 font-bold"
            >
              <Upload className="h-4 w-4" />
              <span>{bulkImport.isPending ? "Importing…" : `Import ${bulkParsedRows.length} Staff`}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
