import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Plus,
  Search,
  Download,
  TrendingUp,
  ShieldCheck,
  CreditCard,
  Building,
  UserCheck,
  Award,
} from "lucide-react";
import { api } from "../../api/client";
import { useMe } from "../../auth/use-me";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Modal } from "../../components/ui/modal";
import { QueryState } from "../../components/query-state";
import { toast } from "../../components/ui/toast";
import { exportToCsv } from "../../lib/csv-export";
import { PageHeader } from "../../components/page-header";

interface SalaryComponent {
  id: string;
  name: string;
  code: string;
  type: "EARNING" | "DEDUCTION";
  isTaxable: boolean;
  isStatutory: boolean;
  description?: string;
}

interface SalaryStructure {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  items: any[];
  _count?: { assignments: number };
}

interface SalaryAssignment {
  id: string;
  personId: string;
  baseGross: number;
  ctc: number;
  paymentMode: string;
  bankAccount?: string;
  bankIfsc?: string;
  panNumber?: string;
  effectiveFrom: string;
  salaryStructure?: SalaryStructure;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    personType: string;
    designation?: { name: string };
    department?: { name: string };
  };
}

interface SalaryRevision {
  id: string;
  oldGross?: number;
  newGross: number;
  effectiveDate: string;
  remarks?: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    designation?: { name: string };
  };
}

export function SalaryStructurePage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canManageSalary = me?.permissionKeys?.includes("payroll.salary.manage");

  const [activeTab, setActiveTab] = useState<"assignments" | "components" | "structures" | "revisions">("assignments");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetPerson, setTargetPerson] = useState<any>(null);
  const [baseGrossInput, setBaseGrossInput] = useState("");
  const [structureSelect, setStructureSelect] = useState("");
  const [paymentModeInput, setPaymentModeInput] = useState("BANK_TRANSFER");
  const [bankAccountInput, setBankAccountInput] = useState("");
  const [bankIfscInput, setBankIfscInput] = useState("");
  const [panNumberInput, setPanNumberInput] = useState("");

  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [newGrossInput, setNewGrossInput] = useState("");
  const [revisionDate, setRevisionDate] = useState(new Date().toISOString().split("T")[0]);
  const [revisionRemarks, setRevisionRemarks] = useState("");

  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [compName, setCompName] = useState("");
  const [compCode, setCompCode] = useState("");
  const [compType, setCompType] = useState<"EARNING" | "DEDUCTION">("EARNING");
  const [compTaxable, setCompTaxable] = useState(true);
  const [compStatutory, setCompStatutory] = useState(false);

  // Queries
  const { data: assignments, isLoading: loadingAssignments, isError: errAssignments, error: assignmentsError, refetch: refetchAssignments } = useQuery({
    queryKey: ["payroll", "salary", "assignments"],
    queryFn: () => api.get<SalaryAssignment[]>("/payroll/salary/assignments"),
  });

  const { data: components, isLoading: loadingComponents, isError: errComponents, error: componentsError, refetch: refetchComponents } = useQuery({
    queryKey: ["payroll", "salary", "components"],
    queryFn: () => api.get<SalaryComponent[]>("/payroll/salary/components"),
  });

  const { data: structures, isLoading: loadingStructures, isError: errStructures, error: structuresError, refetch: refetchStructures } = useQuery({
    queryKey: ["payroll", "salary", "structures"],
    queryFn: () => api.get<SalaryStructure[]>("/payroll/salary/structures"),
  });

  const { data: revisions, isLoading: loadingRevisions, isError: errRevisions, error: revisionsError, refetch: refetchRevisions } = useQuery({
    queryKey: ["payroll", "salary", "revisions"],
    queryFn: () => api.get<SalaryRevision[]>("/payroll/salary/revisions"),
    enabled: activeTab === "revisions",
  });

  const { data: people } = useQuery({
    queryKey: ["hr", "people", "employees-only"],
    queryFn: () => api.get<any[]>("/hr/persons?personType=EMPLOYEE"),
  });

  // Mutations
  const assignMutation = useMutation({
    mutationFn: (data: any) => api.post("/payroll/salary/assignments", data),
    onSuccess: () => {
      toast.success("Salary assignment updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["payroll", "salary", "assignments"] });
      setAssignModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update salary assignment."),
  });

  const revisionMutation = useMutation({
    mutationFn: (data: any) => api.post("/payroll/salary/revisions", data),
    onSuccess: () => {
      toast.success("Compensation revision recorded.");
      queryClient.invalidateQueries({ queryKey: ["payroll", "salary", "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["payroll", "salary", "revisions"] });
      setRevisionModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to record revision."),
  });

  const componentMutation = useMutation({
    mutationFn: (data: any) => api.post("/payroll/salary/components", data),
    onSuccess: () => {
      toast.success("Salary component created.");
      queryClient.invalidateQueries({ queryKey: ["payroll", "salary", "components"] });
      setComponentModalOpen(false);
      setCompName("");
      setCompCode("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create component."),
  });

  const filteredAssignments = (assignments || []).filter((a) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${a.person.firstName} ${a.person.lastName}`.toLowerCase();
    return fullName.includes(q) || a.person.email.toLowerCase().includes(q) || a.person.department?.name?.toLowerCase().includes(q);
  });

  const handleOpenAssign = (person: any, currentAssignment?: SalaryAssignment) => {
    setTargetPerson(person);
    if (currentAssignment) {
      setBaseGrossInput(String(currentAssignment.baseGross));
      setStructureSelect(currentAssignment.salaryStructure?.id || "");
      setPaymentModeInput(currentAssignment.paymentMode || "BANK_TRANSFER");
      setBankAccountInput(currentAssignment.bankAccount || "");
      setBankIfscInput(currentAssignment.bankIfsc || "");
      setPanNumberInput(currentAssignment.panNumber || "");
    } else {
      setBaseGrossInput("");
      setStructureSelect("");
      setPaymentModeInput("BANK_TRANSFER");
      setBankAccountInput("");
      setBankIfscInput("");
      setPanNumberInput("");
    }
    setAssignModalOpen(true);
  };

  const handleOpenRevision = (assignment: SalaryAssignment) => {
    setTargetPerson(assignment.person);
    setNewGrossInput(String(assignment.baseGross));
    setRevisionRemarks("");
    setRevisionModalOpen(true);
  };

  const handleExportCompensationCsv = () => {
    if (!assignments || assignments.length === 0) {
      toast.error("No compensation records to export.");
      return;
    }
    const rows = assignments.map((a) => ({
      "Employee ID": a.person.id.substring(0, 8),
      "Name": `${a.person.firstName} ${a.person.lastName}`,
      "Email": a.person.email,
      "Department": a.person.department?.name || "N/A",
      "Designation": a.person.designation?.name || "N/A",
      "Monthly Gross (INR)": a.baseGross,
      "Annual CTC (INR)": a.ctc,
      "Payment Mode": a.paymentMode,
      "Bank Account": a.bankAccount || "N/A",
      "Bank IFSC": a.bankIfsc || "N/A",
      "PAN Number": a.panNumber || "N/A",
      "Effective From": a.effectiveFrom?.substring(0, 10) || "N/A",
    }));
    exportToCsv("Compensation_Register", rows);
    toast.success("Compensation register exported.");
  };

  const totalMonthlyPayroll = (assignments || []).reduce((sum, a) => sum + Number(a.baseGross || 0), 0);

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        icon={Banknote}
        title="Compensation & Salary Structures"
        description="Manage employee CTC packages, salary templates, statutory deductions, and appraisal histories."
        badge={
          <Badge variant="outline" className="text-xs font-mono">
            {assignments?.length || 0} Staff Assigned
          </Badge>
        }
        action={
          <div className="flex items-center gap-2">
            {activeTab === "assignments" && (
              <Button variant="outline" size="sm" onClick={handleExportCompensationCsv} className="gap-2 text-xs rounded-xl">
                <Download className="h-3.5 w-3.5" />
                Export Register
              </Button>
            )}
            {activeTab === "components" && canManageSalary && (
              <Button size="sm" onClick={() => setComponentModalOpen(true)} className="gap-2 text-xs rounded-xl shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                Add Component
              </Button>
            )}
          </div>
        }
        stats={
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-muted-foreground block font-medium">Assigned Employees</span>
              <span className="text-base font-bold text-foreground">{assignments?.length || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-muted-foreground block font-medium">Total Monthly Gross</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">₹{totalMonthlyPayroll.toLocaleString("en-IN")}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-muted-foreground block font-medium">Salary Templates</span>
              <span className="text-base font-bold text-primary">{structures?.length || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-muted-foreground block font-medium">Salary Components</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">{components?.length || 0}</span>
            </div>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("assignments")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "assignments"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Employee CTC & Salaries ({assignments?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("components")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "components"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Salary Components ({components?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("structures")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "structures"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Structure Templates ({structures?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("revisions")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "revisions"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Appraisals & Revisions
        </button>
      </div>

      {/* TAB 1: Assignments */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, department…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>

          <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <QueryState
                isLoading={loadingAssignments}
                error={assignmentsError}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-muted-foreground">
                        <th className="py-3 px-4 text-left font-semibold">Employee</th>
                        <th className="py-3 px-4 text-left font-semibold">Department & Role</th>
                        <th className="py-3 px-4 text-right font-semibold">Monthly Gross</th>
                        <th className="py-3 px-4 text-right font-semibold">Annual CTC</th>
                        <th className="py-3 px-4 text-left font-semibold">Payment Details</th>
                        <th className="py-3 px-4 text-center font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {filteredAssignments.map((a) => (
                        <tr key={a.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">
                              {a.person.firstName} {a.person.lastName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{a.person.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-foreground">{a.person.department?.name || "General"}</div>
                            <div className="text-[11px] text-muted-foreground">{a.person.designation?.name || "Staff"}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-foreground">
                            ₹{a.baseGross.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            ₹{a.ctc.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-foreground font-medium">
                              <CreditCard className="h-3 w-3 text-muted-foreground" />
                              {a.paymentMode}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {a.bankAccount ? `A/c: ****${a.bankAccount.slice(-4)}` : "No bank linked"}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {canManageSalary && (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAssign(a.person, a)}
                                  className="h-7 text-[11px] px-2"
                                >
                                  Edit CTC
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenRevision(a)}
                                  className="h-7 text-[11px] px-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                >
                                  Appraisal
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: Components */}
      {activeTab === "components" && (
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <QueryState
              isLoading={loadingComponents}
              error={componentsError}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-muted-foreground">
                      <th className="py-3 px-4 text-left font-semibold">Component Name</th>
                      <th className="py-3 px-4 text-left font-semibold">Code</th>
                      <th className="py-3 px-4 text-left font-semibold">Type</th>
                      <th className="py-3 px-4 text-center font-semibold">Taxable</th>
                      <th className="py-3 px-4 text-center font-semibold">Statutory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {(components || []).map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                        <td className="py-3 px-4 font-semibold text-foreground">{c.name}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">{c.code}</td>
                        <td className="py-3 px-4">
                          <Badge variant={c.type === "EARNING" ? "success" : "secondary"}>
                            {c.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {c.isTaxable ? <span className="text-emerald-600 font-semibold">Yes</span> : <span className="text-zinc-400">No</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {c.isStatutory ? <Badge variant="outline">Mandatory</Badge> : <span className="text-zinc-400">Optional</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Structures */}
      {activeTab === "structures" && (
        <QueryState
          isLoading={loadingStructures}
          error={structuresError}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(structures || []).map((s) => (
              <Card key={s.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm">{s.name}</h3>
                  <Badge variant={s.isActive ? "success" : "secondary"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {s.description || "Configured salary breakdown template for staff."}
                </p>
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Assigned Staff</span>
                  <span className="font-semibold text-foreground">{s._count?.assignments ?? 0} Employees</span>
                </div>
              </Card>
            ))}
          </div>
        </QueryState>
      )}

      {/* TAB 4: Revisions */}
      {activeTab === "revisions" && (
        <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <QueryState
              isLoading={loadingRevisions}
              error={revisionsError}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-muted-foreground">
                      <th className="py-3 px-4 text-left font-semibold">Employee</th>
                      <th className="py-3 px-4 text-right font-semibold">Old Gross</th>
                      <th className="py-3 px-4 text-right font-semibold">New Gross</th>
                      <th className="py-3 px-4 text-right font-semibold">Hike</th>
                      <th className="py-3 px-4 text-left font-semibold">Effective Date</th>
                      <th className="py-3 px-4 text-left font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {(revisions || []).map((r) => {
                      const diff = r.newGross - (r.oldGross || 0);
                      const pct = r.oldGross ? ((diff / r.oldGross) * 100).toFixed(1) : "N/A";
                      return (
                        <tr key={r.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-semibold text-foreground">
                            {r.person.firstName} {r.person.lastName}
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground">
                            ₹{(r.oldGross || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-foreground">
                            ₹{r.newGross.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-semibold">
                            +{pct}% (+₹{diff.toLocaleString("en-IN")})
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {r.effectiveDate?.substring(0, 10)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{r.remarks || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </CardContent>
        </Card>
      )}

      {/* Modal: Assign / Edit CTC */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={`Set Compensation: ${targetPerson?.firstName} ${targetPerson?.lastName}`}
        description="Configure monthly base gross salary and payment details."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const gross = parseFloat(baseGrossInput);
            if (!gross || gross <= 0) {
              toast.error("Please enter a valid gross salary amount.");
              return;
            }
            assignMutation.mutate({
              personId: targetPerson.id,
              baseGross: gross,
              salaryStructureId: structureSelect || undefined,
              paymentMode: paymentModeInput,
              bankAccount: bankAccountInput,
              bankIfsc: bankIfscInput,
              panNumber: panNumberInput,
            });
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Monthly Base Gross (INR) *</label>
            <Input
              type="number"
              placeholder="e.g. 45000"
              value={baseGrossInput}
              onChange={(e) => setBaseGrossInput(e.target.value)}
              required
              className="h-9 text-xs"
            />
            {baseGrossInput && (
              <p className="text-[11px] text-muted-foreground">
                Estimated Annual CTC: ₹{(parseFloat(baseGrossInput) * 12).toLocaleString("en-IN")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Salary Structure Template</label>
            <Select
              value={structureSelect}
              onChange={(e) => setStructureSelect(e.target.value)}
              options={[
                { label: "Default Formula (50% Basic, 25% HRA, 10% Conveyance)", value: "" },
                ...(structures?.map((s) => ({ label: s.name, value: s.id })) || []),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Payment Mode</label>
              <Select
                value={paymentModeInput}
                onChange={(e) => setPaymentModeInput(e.target.value)}
                options={[
                  { label: "Bank Transfer (NEFT/RTGS)", value: "BANK_TRANSFER" },
                  { label: "Cheque", value: "CHEQUE" },
                  { label: "Cash", value: "CASH" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">PAN Card Number</label>
              <Input
                placeholder="ABCDE1234F"
                value={panNumberInput}
                onChange={(e) => setPanNumberInput(e.target.value.toUpperCase())}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Bank Account Number</label>
              <Input
                placeholder="Account number"
                value={bankAccountInput}
                onChange={(e) => setBankAccountInput(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Bank IFSC Code</label>
              <Input
                placeholder="e.g. HDFC0001234"
                value={bankIfscInput}
                onChange={(e) => setBankIfscInput(e.target.value.toUpperCase())}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? "Saving…" : "Save Compensation"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Appraisal / Salary Revision */}
      <Modal
        isOpen={revisionModalOpen}
        onClose={() => setRevisionModalOpen(false)}
        title={`Record Appraisal: ${targetPerson?.firstName} ${targetPerson?.lastName}`}
        description="Log salary increments, promotions, and effective appraisal dates."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const gross = parseFloat(newGrossInput);
            if (!gross || gross <= 0) {
              toast.error("Please enter a valid new gross amount.");
              return;
            }
            revisionMutation.mutate({
              personId: targetPerson.id,
              newGross: gross,
              effectiveDate: revisionDate,
              remarks: revisionRemarks,
            });
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Revised Monthly Gross (INR) *</label>
            <Input
              type="number"
              value={newGrossInput}
              onChange={(e) => setNewGrossInput(e.target.value)}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Effective Date *</label>
            <Input
              type="date"
              value={revisionDate}
              onChange={(e) => setRevisionDate(e.target.value)}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Appraisal Remarks / Justification</label>
            <Input
              placeholder="e.g. Annual performance review - Outstanding rating"
              value={revisionRemarks}
              onChange={(e) => setRevisionRemarks(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setRevisionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={revisionMutation.isPending}>
              {revisionMutation.isPending ? "Recording…" : "Confirm Appraisal"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Salary Component */}
      <Modal
        isOpen={componentModalOpen}
        onClose={() => setComponentModalOpen(false)}
        title="Add Salary Component"
        description="Create an earning or deduction component for payroll calculation."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!compName || !compCode) {
              toast.error("Please provide component name and code.");
              return;
            }
            componentMutation.mutate({
              name: compName,
              code: compCode,
              type: compType,
              isTaxable: compTaxable,
              isStatutory: compStatutory,
            });
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Component Name *</label>
            <Input
              placeholder="e.g. Performance Bonus"
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Code *</label>
              <Input
                placeholder="BONUS"
                value={compCode}
                onChange={(e) => setCompCode(e.target.value.toUpperCase())}
                required
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Type</label>
              <Select
                value={compType}
                onChange={(e) => setCompType(e.target.value as any)}
                options={[
                  { label: "Earning (Addition)", value: "EARNING" },
                  { label: "Deduction (Subtraction)", value: "DEDUCTION" },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={compTaxable}
                onChange={(e) => setCompTaxable(e.target.checked)}
                className="rounded text-primary"
              />
              Taxable Component
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={compStatutory}
                onChange={(e) => setCompStatutory(e.target.checked)}
                className="rounded text-primary"
              />
              Statutory / Mandatory
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setComponentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={componentMutation.isPending}>
              {componentMutation.isPending ? "Creating…" : "Save Component"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
