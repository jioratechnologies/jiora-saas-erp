import { useState, useRef, useEffect } from "react";
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
  MoreVertical,
  Copy,
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
  ArrowRight,
  Plus,
  X,
} from "lucide-react";
import { api, ApiError } from "../../api/client";
import { Button } from "../../components/ui/button";
import { ButtonGroup } from "../../components/ui/button-group";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { DatePicker } from "../../components/ui/date-picker";
import { DateInput } from "../../components/ui/date-input";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "../../components/ui/dropdown";
import { FileDropzone } from "../../components/ui/file-dropzone";
import { Badge } from "../../components/ui/badge";
import { User, Avatar } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, usePagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/page-header";
import { QueryState } from "../../components/query-state";
import { Modal, Drawer } from "../../components/ui/modal";
import { PhoneInput } from "../../components/ui/phone-input";
import { useConfirm } from "../../hooks/use-confirm";
import { toast } from "../../components/ui/toast";
import { useAuthStore } from "../../auth/auth-store";
import { useMe } from "../../auth/use-me";
import { formatErrorMessage } from "../../lib/error-formatter";
import {
  INPUT_LIMITS,
  EMERGENCY_RELATIONS,
  parseEmergencyContact,
  formatEmergencyContact,
  type EmergencyRelation,
} from "../../lib/input-constraints";
import { cn } from "../../lib/utils";
import { exportToCsv } from "../../lib/csv-export";

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
  lastName: string;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
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
    lastName: string;
    email: string;
    department?: DepartmentOption | null;
    designation?: DesignationOption | null;
    manager?: { id: string; firstName: string; lastName: string } | null;
  } | null;
  directReports?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    personType?: string;
    department?: DepartmentOption | null;
    designation?: DesignationOption | null;
    status?: string;
  }[];
  documents?: PersonDocument[];
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
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkParsedRows, setBulkParsedRows] = useState<any[]>([]);

  // Exit Checklist Drawer State
  const [assetReturn, setAssetReturn] = useState(false);
  const [idCardReturn, setIdCardReturn] = useState(false);
  const [knowledgeHandover, setKnowledgeHandover] = useState(false);
  const [financeClearance, setFinanceClearance] = useState(false);
  const [exitClearanceNotes, setExitClearanceNotes] = useState("");

  // Edit Person & Reporting State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editSameAsPhone, setEditSameAsPhone] = useState(true);
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [editDesignationId, setEditDesignationId] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [editStatus, setEditStatus] = useState<Person["status"]>("ACTIVE");
  const [editPersonType, setEditPersonType] = useState<"EMPLOYEE" | "VOLUNTEER">("EMPLOYEE");
  const [editAddress, setEditAddress] = useState("");
  const [editCurrentAddress, setEditCurrentAddress] = useState("");
  const [editPermanentAddress, setEditPermanentAddress] = useState("");
  const [editSameAsCurrentAddress, setEditSameAsCurrentAddress] = useState(true);
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [editEmergencyRelation, setEditEmergencyRelation] = useState<EmergencyRelation>("Spouse");
  const [editEmergencyName, setEditEmergencyName] = useState("");

  // In-App Document Viewer State
  const [viewDocModalOpen, setViewDocModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PersonDocument | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
  const [docNumber, setDocNumber] = useState("");
  const [docCategory, setDocCategory] = useState<"KYC" | "RESUME" | "CONTRACT" | "OTHER">("KYC");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Exit Workflow State
  const [exitDate, setExitDate] = useState("");
  const [exitReason, setExitReason] = useState("");

  // Queries
  const {
    data: people,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["hr", "people", personTypeFilter, statusFilter, departmentFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (personTypeFilter !== "ALL") params.set("personType", personTypeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (departmentFilter !== "ALL") params.set("departmentId", departmentFilter);
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

  const { data: myProfile } = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: () => api.get<any>("/auth/profile"),
  });
  const myDepartmentId = departments?.find(
    (d) => d.name === myProfile?.user?.department || d.name === myProfile?.person?.department
  )?.id;

  // Client-side pagination & DOM virtualization for high performance
  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedPeople,
  } = usePagination(people || [], 10);

  // Selected person detail query for Drawer
  const { data: selectedPerson, refetch: refetchSelectedPerson } = useQuery({
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
    mutationFn: ({ personId, checklist, isFinalized }: { personId: string; checklist: any; isFinalized?: boolean }) =>
      api.patch(`/hr/persons/${personId}/exit-checklist`, { ...checklist, isFinalized }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      toast.success("Exit checklist updated", "Offboarding clearance record saved.");
    },
    onError: (err) => {
      toast.error("Failed to update exit checklist", (err as Error).message);
    },
  });

  const bulkImport = useMutation({
    mutationFn: (records: any[]) =>
      api.post<{ total: number; importedCount: number; failedCount: number; errors: any[] }>(
        "/hr/persons/bulk-import",
        { records }
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      toast.success("Bulk import completed", `Imported ${res.importedCount} of ${res.total} staff members.`);
      setBulkImportModalOpen(false);
      setBulkCsvText("");
      setBulkParsedRows([]);
    },
    onError: (err) => {
      toast.error("Bulk import failed", (err as Error).message);
    },
  });

  const handleExportStaffDirectory = () => {
    if (!people || people.length === 0) {
      toast.error("No staff to export", "No records found matching current filters.");
      return;
    }
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Person Type",
      "Status",
      "Department",
      "Designation",
      "Reporting Manager",
      "Joining Date",
      "Exit Date",
      "Exit Reason",
    ];
    const rows = people.map((p) => [
      p.firstName,
      p.lastName,
      p.email,
      p.phone || "",
      p.personType,
      p.status,
      p.department?.name || "",
      p.designation?.name || "",
      p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : "",
      p.joiningDate ? new Date(p.joiningDate).toLocaleDateString() : "",
      p.exitDate ? new Date(p.exitDate).toLocaleDateString() : "",
      p.exitReason || "",
    ]);
    exportToCsv("Staff_Directory_Export", headers, rows);
    toast.success("Staff directory exported", `${rows.length} records downloaded.`);
  };

  const handleDownloadSampleCsv = () => {
    const headers = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "personType",
      "departmentName",
      "designationName",
      "joiningDate",
    ];
    const sampleRows = [
      ["Pooja", "Sharma", "pooja.sharma@example.org", "+91 9876543210", "EMPLOYEE", "Programmes", "Project Coordinator", "2026-02-01"],
      ["Amit", "Verma", "amit.verma@example.org", "+91 9812345678", "VOLUNTEER", "Field Operations", "Field Volunteer", "2026-03-15"],
    ];
    exportToCsv("sample_staff_import", headers, sampleRows);
    toast.success("Template downloaded", "Fill in your staff details and upload.");
  };

  const handleParseCsv = (rawText: string) => {
    setBulkCsvText(rawText);
    const lines = rawText.trim().split("\n").filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      setBulkParsedRows([]);
      return;
    }
    const headers = lines[0].split(",").map((h) => h.replace(/["\r]/g, "").trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.replace(/["\r]/g, "").trim());
      const rowObj: any = {};
      headers.forEach((h, i) => {
        rowObj[h] = values[i] || "";
      });
      return {
        firstName: rowObj.firstname || rowObj["first name"] || "",
        lastName: rowObj.lastname || rowObj["last name"] || "",
        email: rowObj.email || "",
        phone: rowObj.phone || "",
        personType: (rowObj.persontype || rowObj["person type"] || "EMPLOYEE").toUpperCase() === "VOLUNTEER" ? "VOLUNTEER" : "EMPLOYEE",
        departmentName: rowObj.departmentname || rowObj.department || "",
        designationName: rowObj.designationname || rowObj.designation || "",
        joiningDate: rowObj.joiningdate || rowObj["joining date"] || new Date().toISOString().split("T")[0],
      };
    }).filter((r) => r.email && r.firstName);

    setBulkParsedRows(rows);
  };

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
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
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

  const handleOpenEditModal = (p: Person) => {
    setEditFirstName(p.firstName || "");
    setEditLastName(p.lastName || "");
    setEditPhone(p.phone || "");
    setEditWhatsapp(p.whatsapp || p.phone || "");
    setEditSameAsPhone(!p.whatsapp || p.whatsapp === p.phone);
    setEditDepartmentId(p.departmentId || "");
    setEditDesignationId(p.designationId || "");
    setEditManagerId(p.managerId || "");
    setEditStatus(p.status || "ACTIVE");
    setEditPersonType(p.personType || "EMPLOYEE");
    
    const currAddr = p.currentAddress || p.address || "";
    const permAddr = p.permanentAddress || currAddr;
    setEditCurrentAddress(currAddr);
    setEditPermanentAddress(permAddr);
    setEditSameAsCurrentAddress(!p.permanentAddress || p.permanentAddress === currAddr);
    setEditAddress(currAddr);

    const parsed = parseEmergencyContact(p.emergencyContact);
    setEditEmergencyPhone(parsed.phone);
    setEditEmergencyRelation((parsed.relation as EmergencyRelation) || "Spouse");
    setEditEmergencyName(parsed.name);

    setEditModalOpen(true);
  };

  const handleEditManagerChange = (mId: string) => {
    setEditManagerId(mId);
    if (mId) {
      const mgr = people?.find((p) => p.id === mId);
      if (mgr?.departmentId && !editDepartmentId) {
        setEditDepartmentId(mgr.departmentId);
        toast.info("Department Synced", `Connected department to ${mgr.department?.name || "manager's department"}.`);
      }
    }
  };

  const handleCreateManagerChange = (mId: string) => {
    setManagerId(mId);
    if (mId) {
      const mgr = people?.find((p) => p.id === mId);
      if (mgr?.departmentId && !departmentId) {
        setDepartmentId(mgr.departmentId);
      }
    }
  };

  const updatePersonMutation = useMutation({
    mutationFn: () => {
      const emergencyContact = formatEmergencyContact(editEmergencyPhone, editEmergencyRelation, editEmergencyName);
      const finalWhatsapp = editSameAsPhone ? editPhone.trim() : editWhatsapp.trim();
      const finalPermAddr = editSameAsCurrentAddress ? editCurrentAddress.trim() : editPermanentAddress.trim();
      return api.patch(`/hr/persons/${selectedPersonId}`, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        phone: editPhone.trim(),
        whatsapp: finalWhatsapp,
        departmentId: editDepartmentId || null,
        designationId: editDesignationId || null,
        managerId: editManagerId || null,
        status: editStatus,
        personType: editPersonType,
        currentAddress: editCurrentAddress.trim(),
        permanentAddress: finalPermAddr,
        address: editCurrentAddress.trim(),
        emergencyContact,
      });
    },
    onSuccess: () => {
      setEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["hr", "people"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      refetchSelectedPerson();
      toast.success("Profile updated", "Reporting manager, department, and profile details saved.");
    },
    onError: (err: any) => {
      toast.error("Update failed", err.message || "Failed to update person.");
    },
  });

  const handleOpenDocViewer = async (doc: PersonDocument) => {
    setPreviewDoc(doc);
    setPreviewDocUrl(null);
    setLoadingPreview(true);
    setViewDocModalOpen(true);
    try {
      const data = await api.get<{ downloadUrl?: string; url?: string }>(
        `/hr/persons/${selectedPersonId}/documents/${doc.id}/url`
      );
      setPreviewDocUrl(data.downloadUrl || data.url || null);
    } catch (err: any) {
      toast.error("Preview failed", err.message || "Could not generate preview link.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedPersonId || !selectedFile || !docName.trim()) return;

    if (docCategory === "KYC" && !docNumber.trim()) {
      toast.error("Document Number required", "Please enter the document / ID number for KYC verification.");
      return;
    }

    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", docName.trim());
      formData.append("category", docCategory);
      if (docCategory === "KYC" && docNumber.trim()) {
        formData.append("documentNumber", docNumber.trim());
      }

      await api.upload(`/hr/persons/${selectedPersonId}/documents`, formData);

      setDocName("");
      setDocNumber("");
      setSelectedFile(null);
      setShowUploadForm(false);
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
        badge={{ label: `${people?.length || 0} Staff`, variant: "secondary" }}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportStaffDirectory}
              className="gap-1 font-semibold rounded-xl text-xs h-8 px-2 sm:px-3"
              title="Export Staff Directory (CSV)"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkCsvText("");
                  setBulkParsedRows([]);
                  setBulkImportModalOpen(true);
                }}
                className="gap-1 font-semibold rounded-xl text-xs h-8 px-2 sm:px-3"
                title="Bulk Import Staff (CSV/Excel)"
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
          { label: "All Staff", value: people?.length || 0 },
          {
            label: "Employees",
            value: people?.filter((p) => p.personType === "EMPLOYEE").length || 0,
            color: "text-primary",
          },
          {
            label: "Volunteers",
            value: people?.filter((p) => p.personType === "VOLUNTEER").length || 0,
            color: "text-amber-500",
          },
          {
            label: "Active",
            value: people?.filter((p) => p.status === "ACTIVE").length || 0,
            color: "text-emerald-500",
          },
        ]}
      />

      {/* Filters and Search Bar */}
      <Card className="rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
        <CardContent className="p-2.5 sm:p-4 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          {/* Mobile: Search first for instant query */}
          <div className="relative w-full sm:hidden">
            <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs rounded-xl"
            />
          </div>

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
          <div className="relative sm:w-64 hidden sm:block shrink-0">
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
              • Focused scope for task escalation, attendance, and approvals ({people?.length ?? 0} members)
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
          <QueryState isLoading={isLoading} error={error}>
            {/* Mobile Native Card View (Phones < 640px) */}
            <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {people?.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No staff records found matching your filters.
                </div>
              ) : (
                paginatedPeople.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPersonId(p.id)}
                    className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors cursor-pointer space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={`${p.firstName} ${p.lastName}`}
                          src={p.avatarUrl || undefined}
                          size="md"
                          isBordered
                          status={p.status === "ACTIVE" ? "online" : undefined}
                          className="shrink-0 h-10 w-10 text-xs"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-sm text-foreground truncate">
                              {p.firstName} {p.lastName}
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
                ))
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
                  {people?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                        No records found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPeople.map((p) => (
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
                              onClick={() => setSelectedPersonId(p.id)}
                              className="text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 h-8 px-2.5"
                            >
                              View
                            </Button>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu align="end">
                                <DropdownItem
                                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                                  onClick={() => setSelectedPersonId(p.id)}
                                >
                                  View Profile
                                </DropdownItem>
                                <DropdownItem
                                  icon={<Copy className="h-3.5 w-3.5" />}
                                  onClick={() => {
                                    navigator.clipboard.writeText(p.email);
                                    toast.success("Email copied", p.email);
                                  }}
                                >
                                  Copy Email
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
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
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-semibold transition-all ${newPersonType === "EMPLOYEE"
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
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-semibold transition-all ${newPersonType === "VOLUNTEER"
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
                maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Last Name *</label>
              <Input
                placeholder="Kumar"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Email Address *</label>
            <Input
              type="email"
              placeholder="ramesh@example.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={INPUT_LIMITS.EMAIL_MAX}
              required
            />
          </div>

          <PhoneInput
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            placeholder="Mobile number"
          />

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
              label="Designation / Role"
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
              label="Reporting Manager (Hierarchy)"
              value={managerId}
              onChange={(e) => handleCreateManagerChange(e.target.value)}
            >
              <option value="">None (Top-Level Executive)</option>
              {departmentId && people?.some((p) => p.status === "ACTIVE" && p.departmentId === departmentId) && (
                <optgroup label={`Team Leads in ${departments?.find((d) => d.id === departmentId)?.name || "Selected Dept"}`}>
                  {people
                    ?.filter((p) => p.status === "ACTIVE" && p.departmentId === departmentId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} — {p.designation?.name || p.email}
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label={departmentId ? "Executive Leadership & Other Departments" : "All Available Managers"}>
                {people
                  ?.filter((p) => p.status === "ACTIVE" && (!departmentId || p.departmentId !== departmentId))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} — {p.designation?.name || p.email} ({p.department?.name || "No Dept"})
                    </option>
                  ))}
              </optgroup>
            </Select>
            <DatePicker
              label="Joining Date"
              value={joiningDate}
              onChange={(val) => setJoiningDate(val)}
            />
          </div>

          {/* Connected Placement Preview */}
          {(departmentId || designationId || managerId) && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Network className="h-3.5 w-3.5 text-primary" />
                  Organizational Placement & Hierarchy
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 font-medium">
                  {managerId ? "Manager Linked" : "Top Executive"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Department</span>
                  <span className="font-semibold text-foreground truncate block">
                    {departments?.find((d) => d.id === departmentId)?.name || "(Unassigned)"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Role</span>
                  <span className="font-semibold text-foreground truncate block">
                    {designations?.find((d) => d.id === designationId)?.name || "(Unassigned)"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Supervisor</span>
                  <span className="font-semibold text-foreground truncate block">
                    {people?.find((p) => p.id === managerId)
                      ? `${people.find((p) => p.id === managerId)!.firstName} ${people.find((p) => p.id === managerId)!.lastName}`
                      : "None (Direct to Board)"}
                  </span>
                </div>
              </div>
            </div>
          )}

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
                    name={`${selectedPerson.firstName} ${selectedPerson.lastName}`}
                    src={selectedPerson.avatarUrl || undefined}
                    size="lg"
                    isBordered
                    status={selectedPerson.status === "ACTIVE" ? "online" : undefined}
                    className="h-12 w-12 text-sm shadow-xs shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-foreground text-base truncate">
                        {selectedPerson.firstName} {selectedPerson.lastName}
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

              {/* Sticky Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 min-w-0">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                    <Building className="h-3 w-3 text-primary shrink-0" /> Dept
                  </span>
                  <p className="font-semibold text-foreground truncate mt-0.5 text-xs">
                    {selectedPerson.department?.name || "Not assigned"}
                  </p>
                </div>

                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 min-w-0">
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
                        {selectedPerson.manager.firstName} {selectedPerson.manager.lastName}
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

                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 min-w-0">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" /> Contact
                  </span>
                  <p className="font-semibold text-foreground truncate font-mono mt-0.5 text-xs">
                    {selectedPerson.phone || "Not recorded"}
                  </p>
                </div>

                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 min-w-0">
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
            </div>
          ) : undefined
        }
      >
        {selectedPerson && (
          <div className="space-y-6">
            {/* Address, WhatsApp & Emergency Contact Summary */}
            {(selectedPerson.currentAddress || selectedPerson.permanentAddress || selectedPerson.address || selectedPerson.whatsapp || selectedPerson.emergencyContact) && (
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
                {selectedPerson.whatsapp && (
                  <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <span className="text-muted-foreground font-medium flex items-center gap-1 mb-1">
                      <Phone className="h-3 w-3 text-emerald-500" /> WhatsApp Number
                    </span>
                    <p className="text-foreground font-mono font-semibold">{selectedPerson.whatsapp}</p>
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
                          {dr.firstName} {dr.lastName}
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

            {/* Documents Section (MinIO Object Storage) */}
            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Documents & KYC ({selectedPerson.documents?.length || 0})
                  </h5>
                  <p className="text-[11px] text-muted-foreground">Stored securely in MinIO Object Storage</p>
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
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-1">
                        Document Title *
                      </label>
                      <Input
                        placeholder="e.g. Aadhaar Card / Resume"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        maxLength={INPUT_LIMITS.DOC_TITLE_MAX}
                        className="h-9 text-xs"
                      />
                    </div>
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
                  </div>

                  {docCategory === "KYC" && (
                    <div>
                      <label className="text-[11px] font-medium text-foreground block mb-1">
                        Document / ID Number *
                      </label>
                      <Input
                        placeholder="e.g. 5423-8891-1029 / ABCDE1234F / Passport No"
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
                      disabled={!selectedFile || !docName.trim() || (docCategory === "KYC" && !docNumber.trim()) || uploadingDoc}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingDoc ? "Uploading to MinIO…" : "Upload Document"}</span>
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-foreground truncate">{doc.name}</p>
                                {isApproved && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle className="h-3 w-3" /> Verified
                                  </span>
                                )}
                                {isPending && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                    <Clock className="h-3 w-3" /> Pending Review
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-red-500/15 text-red-700 dark:text-red-300">
                                    <XCircle className="h-3 w-3" /> Rejected
                                  </span>
                                )}
                              </div>

                              {doc.documentNumber && (
                                <p className="text-[11px] font-mono text-foreground font-semibold mt-0.5">
                                  ID: <span className="text-primary">{doc.documentNumber}</span>
                                </p>
                              )}

                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                <Badge size="sm" variant="secondary">
                                  {doc.category}
                                </Badge>
                                <span>{formatFileSize(bytes)}</span>
                                <span>•</span>
                                <span>{formattedDate}</span>
                              </div>

                              {isRejected && doc.rejectionReason && (
                                <div className="mt-1.5 p-1.5 rounded-lg bg-red-500/10 text-[10px] text-red-600 dark:text-red-400 font-medium">
                                  <strong>HR Note:</strong> {doc.rejectionReason}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* In-App View Document Button */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenDocViewer(doc)}
                              className="h-8 px-2 gap-1 text-xs text-primary hover:bg-primary/10 border-primary/20"
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
                                    className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors text-[11px] font-semibold"
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
                                    className="px-2 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-colors text-[11px] font-semibold"
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
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Finalize exit for ${selectedPerson.firstName}?`,
                              description: "This will mark the record as EXITED and complete offboarding.",
                              confirmLabel: "Finalize & Close",
                            });
                            if (ok) {
                              updateExitChecklist.mutate({
                                personId: selectedPerson.id,
                                checklist: {
                                  assetReturn,
                                  idCardReturn,
                                  knowledgeHandover,
                                  financeClearance,
                                  notes: exitClearanceNotes,
                                },
                                isFinalized: true,
                              });
                            }
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

      {/* Edit Profile & Reporting Hierarchy Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Profile & Reporting Hierarchy"
        description="Update departmental placement, reporting manager, status, and contact details."
        maxWidth="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updatePersonMutation.mutate();
          }}
          className="space-y-4"
        >
          {/* Person Type & Status */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Person Type"
              value={editPersonType}
              onChange={(e) => setEditPersonType(e.target.value as any)}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="VOLUNTEER">Volunteer</option>
            </Select>

            <Select
              label="Employment Status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as any)}
            >
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="NOTICE_PERIOD">Notice Period</option>
              <option value="JOINED">Joined</option>
            </Select>
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">First Name *</label>
              <Input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Last Name *</label>
              <Input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                maxLength={INPUT_LIMITS.PERSON_NAME_MAX}
                required
              />
            </div>
          </div>

          {/* Phone & WhatsApp */}
          <div className="space-y-3">
            <PhoneInput
              label="Contact Mobile Number"
              value={editPhone}
              onChange={(val) => {
                setEditPhone(val);
                if (editSameAsPhone) setEditWhatsapp(val);
              }}
              placeholder="Mobile number"
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground block">WhatsApp Number</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={editSameAsPhone}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditSameAsPhone(checked);
                      if (checked) setEditWhatsapp(editPhone);
                    }}
                    className="rounded-md border-input h-3.5 w-3.5 text-primary focus:ring-primary cursor-pointer"
                  />
                  <span>Same as Phone number</span>
                </label>
              </div>
              {!editSameAsPhone ? (
                <PhoneInput
                  value={editWhatsapp}
                  onChange={setEditWhatsapp}
                  placeholder="Enter WhatsApp mobile number"
                />
              ) : (
                <div className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs font-mono text-muted-foreground flex items-center justify-between">
                  <span>{editPhone || "Same as primary phone number"}</span>
                  <span className="text-[11px] font-sans font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Synced with Phone
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Department & Designation */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Department"
              value={editDepartmentId}
              onChange={(e) => setEditDepartmentId(e.target.value)}
            >
              <option value="">(None / Unassigned)</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>

            <Select
              label="Designation / Role"
              value={editDesignationId}
              onChange={(e) => setEditDesignationId(e.target.value)}
            >
              <option value="">(None / Unassigned)</option>
              {designations?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>

          {/* Reporting Manager (Hierarchy) */}
          <div className="space-y-1.5">
            <Select
              label="Reporting Manager (Hierarchy)"
              value={editManagerId}
              onChange={(e) => handleEditManagerChange(e.target.value)}
            >
              <option value="">None (Top-Level Executive / Board Director)</option>
              {editDepartmentId && people?.some((p) =>
                p.status === "ACTIVE" &&
                p.id !== selectedPersonId &&
                p.departmentId === editDepartmentId &&
                !selectedPerson?.directReports?.some((dr) => dr.id === p.id),
              ) && (
                <optgroup label={`Team Leads & Managers in ${departments?.find((d) => d.id === editDepartmentId)?.name || "Selected Dept"}`}>
                  {people
                    ?.filter(
                      (p) =>
                        p.status === "ACTIVE" &&
                        p.id !== selectedPersonId &&
                        p.departmentId === editDepartmentId &&
                        !selectedPerson?.directReports?.some((dr) => dr.id === p.id),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} — {p.designation?.name || p.email}
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label={editDepartmentId ? "Executive Leadership & Other Departments" : "All Available Managers"}>
                {people
                  ?.filter(
                    (p) =>
                      p.status === "ACTIVE" &&
                      p.id !== selectedPersonId &&
                      (!editDepartmentId || p.departmentId !== editDepartmentId) &&
                      !selectedPerson?.directReports?.some((dr) => dr.id === p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} — {p.designation?.name || p.email} ({p.department?.name || "No Dept"})
                    </option>
                  ))}
              </optgroup>
            </Select>

            {/* Sync Department Prompt if mismatch */}
            {selectedPersonId && (() => {
              const selectedMgr = people?.find((p) => p.id === editManagerId);
              if (selectedMgr?.departmentId && selectedMgr.departmentId !== editDepartmentId) {
                return (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 text-[11px] text-muted-foreground border border-zinc-200/60 dark:border-zinc-700/60">
                    <span>
                      Manager is in <strong className="text-foreground">{selectedMgr.department?.name || "another dept"}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditDepartmentId(selectedMgr.departmentId!);
                        toast.info("Department Synced", `Set department to ${selectedMgr.department?.name}.`);
                      }}
                      className="text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Building className="h-3 w-3" /> Sync to {selectedMgr.department?.name}
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* Organizational Placement & Hierarchy Card */}
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Network className="h-3.5 w-3.5 text-primary" />
                  Organizational Hierarchy & Placement
                </span>
                {editManagerId ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 font-medium">
                    Supervisor Linked
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 font-medium">
                    Top-Level Executive
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                <div className="p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/60">
                  <span className="text-muted-foreground block text-[10px]">Department</span>
                  <span className="font-semibold text-foreground truncate block">
                    {departments?.find((d) => d.id === editDepartmentId)?.name || "(Unassigned)"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/60">
                  <span className="text-muted-foreground block text-[10px]">Role / Designation</span>
                  <span className="font-semibold text-foreground truncate block">
                    {designations?.find((d) => d.id === editDesignationId)?.name || "(Unassigned)"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/60">
                  <span className="text-muted-foreground block text-[10px]">Reports To</span>
                  <span className="font-semibold text-foreground truncate block">
                    {people?.find((p) => p.id === editManagerId)
                      ? `${people.find((p) => p.id === editManagerId)!.firstName} ${people.find((p) => p.id === editManagerId)!.lastName}`
                      : "None (Direct to Board)"}
                  </span>
                </div>
              </div>

              {/* Reporting Chain */}
              <div className="text-[11px] text-muted-foreground pt-1 border-t border-zinc-200/50 dark:border-zinc-800 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-foreground">Chain:</span>
                <span className="text-foreground font-medium">{editFirstName || "Person"} {editLastName || ""}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                {people?.find((p) => p.id === editManagerId) ? (
                  <>
                    <span className="text-foreground font-medium">
                      {people.find((p) => p.id === editManagerId)!.firstName} {people.find((p) => p.id === editManagerId)!.lastName}
                      {people.find((p) => p.id === editManagerId)!.designation?.name
                        ? ` (${people.find((p) => p.id === editManagerId)!.designation?.name})`
                        : ""}
                    </span>
                    {people.find((p) => p.id === editManagerId)!.manager && (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium">
                          {people.find((p) => p.id === editManagerId)!.manager!.firstName} {people.find((p) => p.id === editManagerId)!.manager!.lastName}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-amber-500 font-medium">Direct to Board / Executive Director</span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Top executives have no manager. Self and direct reports are filtered out to prevent circular reporting cycles.
            </p>
          </div>

          {/* Addresses: Current & Permanent */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">Current Residential Address</label>
              <Input
                value={editCurrentAddress}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditCurrentAddress(val);
                  if (editSameAsCurrentAddress) setEditPermanentAddress(val);
                }}
                placeholder="Current address: Flat/House, Street, City, State, Pincode"
                maxLength={INPUT_LIMITS.ADDRESS_MAX}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground block">Permanent Address</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={editSameAsCurrentAddress}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditSameAsCurrentAddress(checked);
                      if (checked) setEditPermanentAddress(editCurrentAddress);
                    }}
                    className="rounded-md border-input h-3.5 w-3.5 text-primary focus:ring-primary cursor-pointer"
                  />
                  <span>Same as Current address</span>
                </label>
              </div>
              {!editSameAsCurrentAddress ? (
                <Input
                  value={editPermanentAddress}
                  onChange={(e) => setEditPermanentAddress(e.target.value)}
                  placeholder="Permanent address: Hometown / Official permanent address"
                  maxLength={INPUT_LIMITS.ADDRESS_MAX}
                />
              ) : (
                <div className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-muted-foreground flex items-center justify-between">
                  <span className="truncate">{editCurrentAddress || "Same as current residential address"}</span>
                  <span className="text-[11px] font-sans font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
                    Synced with Current
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <HeartHandshake className="h-3.5 w-3.5 text-primary" /> Emergency Contact
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-3">
                <PhoneInput
                  label="Emergency Phone"
                  value={editEmergencyPhone}
                  onChange={setEditEmergencyPhone}
                  placeholder="Emergency contact phone"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Relation</label>
                <Select
                  value={editEmergencyRelation}
                  onChange={(e) => setEditEmergencyRelation(e.target.value as EmergencyRelation)}
                >
                  {EMERGENCY_RELATIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground block mb-1">Contact Person Name</label>
                <Input
                  value={editEmergencyName}
                  onChange={(e) => setEditEmergencyName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  maxLength={INPUT_LIMITS.EMERGENCY_NAME_MAX}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!editFirstName.trim() || !editLastName.trim() || updatePersonMutation.isPending}>
              {updatePersonMutation.isPending ? "Saving changes…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* In-App Document Viewer & Review Modal */}
      <Modal
        isOpen={viewDocModalOpen}
        onClose={() => {
          setViewDocModalOpen(false);
          setPreviewDoc(null);
          setPreviewDocUrl(null);
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
                <p className="text-xs text-muted-foreground">Streaming secure document preview from MinIO…</p>
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
          setBulkCsvText("");
          setBulkParsedRows([]);
        }}
        title="Bulk Staff & Volunteer Onboarding"
        description="Upload a CSV file or paste formatted CSV records to batch-create profiles."
      >
        <div className="space-y-4 pt-2">
          {/* Step 1: Download Template */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs">
            <div>
              <p className="font-semibold text-foreground">Need the standard spreadsheet format?</p>
              <p className="text-[11px] text-muted-foreground">Includes pre-configured headers and sample rows.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSampleCsv}
              className="gap-1.5 shrink-0 bg-white dark:bg-zinc-900 border-primary/30 text-primary font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download CSV Template</span>
            </Button>
          </div>

          {/* Step 2: Upload or Paste CSV */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">CSV File or Data</label>
              <label className="text-xs text-primary font-semibold cursor-pointer hover:underline">
                Upload .csv file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        handleParseCsv(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
            <textarea
              rows={6}
              value={bulkCsvText}
              onChange={(e) => handleParseCsv(e.target.value)}
              placeholder={`firstName,lastName,email,phone,personType,departmentName,designationName,joiningDate\nPooja,Sharma,pooja@example.org,+91 9876543210,EMPLOYEE,Programmes,Project Coordinator,2026-02-01`}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Preview of Parsed Rows */}
          {bulkParsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Ready to Import: <strong className="text-primary">{bulkParsedRows.length}</strong> staff members
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-1.5">Name</th>
                      <th className="p-1.5">Email</th>
                      <th className="p-1.5">Type</th>
                      <th className="p-1.5">Dept</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {bulkParsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="p-1.5 font-medium">{r.firstName} {r.lastName}</td>
                        <td className="p-1.5 font-mono text-muted-foreground">{r.email}</td>
                        <td className="p-1.5"><Badge size="sm" variant="outline">{r.personType}</Badge></td>
                        <td className="p-1.5">{r.departmentName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkImportModalOpen(false);
                setBulkCsvText("");
                setBulkParsedRows([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => bulkImport.mutate(bulkParsedRows)}
              disabled={bulkParsedRows.length === 0 || bulkImport.isPending}
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
