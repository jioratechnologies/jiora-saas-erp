import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  Download,
  Eye,
  Printer,
  Calendar,
  Building,
  CreditCard,
  CheckCircle,
  Clock,
  Sparkles,
  FileText,
} from "lucide-react";
import { api } from "../../api/client";
import { useMe } from "../../auth/use-me";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Modal } from "../../components/ui/modal";
import { QueryState } from "../../components/query-state";
import { toast } from "../../components/ui/toast";
import { PageHeader } from "../../components/page-header";
import { Pagination, usePagination } from "../../components/ui/pagination";

interface Payslip {
  id: string;
  year: number;
  month: number;
  totalWorkingDays: number;
  presentDays: number;
  lopDays: number;
  earnings: Array<{ code: string; name: string; amount: number }>;
  deductions: Array<{ code: string; name: string; amount: number }>;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paymentStatus: "PENDING" | "PAID";
  paymentReference?: string;
  createdAt: string;
  payrollRun: {
    title: string;
    status: string;
  };
}

interface DetailedPayslip extends Payslip {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    panNumber?: string;
    bankAccount?: string;
    bankIfsc?: string;
    department?: { name: string };
    designation?: { name: string };
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function numberToWordsINR(amount: number): string {
  // Simple integer INR wording
  const num = Math.round(amount);
  if (num === 0) return "Zero Rupees Only";
  return `${num.toLocaleString("en-IN")} Rupees Only`;
}

export function MyPayslipsPage() {
  const { data: me } = useMe();
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);

  // Queries
  const { data: payslips, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["payroll", "runs", "my-payslips"],
    queryFn: () => api.get<Payslip[]>("/payroll/runs/my-payslips"),
  });

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedPayslips,
  } = usePagination(payslips || [], 10);

  const { data: detailedPayslip, isLoading: loadingDetail } = useQuery({
    queryKey: ["payroll", "payslips", "detail", selectedPayslipId],
    queryFn: () => api.get<DetailedPayslip>(`/payroll/runs/payslips/${selectedPayslipId}`),
    enabled: !!selectedPayslipId,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3.5 sm:space-y-5 md:space-y-6 w-full">
      {/* Sticky Enterprise Header */}
      <PageHeader
        title="My Payslips & Compensation"
        description="View and download your monthly salary slips, itemized earnings, and statutory deductions."
        icon={Receipt}
        badge={{ label: `${payslips?.length ?? 0} Statements`, variant: "secondary" }}
        stats={[
          { label: "Available Slips", value: payslips?.length ?? 0 },
          {
            label: "Latest Disbursed Net",
            value:
              payslips && payslips.length > 0
                ? `₹${Number(payslips[0].netPay).toLocaleString("en-IN")}`
                : "—",
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Payment Status",
            value: payslips && payslips.length > 0 ? payslips[0].paymentStatus : "N/A",
            color:
              payslips?.[0]?.paymentStatus === "PAID"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400",
          },
        ]}
      />

      {/* Payslips Container */}
      <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <CardHeader className="py-2.5 px-4 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs sm:text-sm font-semibold">Salary Slips History</CardTitle>
            <CardDescription className="text-[11px] sm:text-xs">
              Official monthly pay records generated per payroll cycle.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono shrink-0">
            {payslips?.length || 0} Records
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState isLoading={isLoading} error={error}>
            {/* Mobile Native Card View */}
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 sm:hidden">
              {(payslips || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No salary slips generated yet.
                </div>
              ) : (
                paginatedPayslips.map((p) => {
                  const statusVariant = p.paymentStatus === "PAID" ? "success" : "secondary";
                  return (
                    <div key={p.id} className="p-3.5 space-y-2.5 bg-background hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-xs text-foreground truncate">
                            {MONTH_NAMES[p.month - 1]} {p.year}
                          </span>
                        </div>
                        <Badge variant={statusVariant} size="sm" className="text-[10px]">
                          {p.paymentStatus}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate">{p.payrollRun.title}</p>

                      <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 text-[11px]">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Net Pay</span>
                          <span className="font-bold text-foreground text-xs">₹{p.netPay.toLocaleString("en-IN")}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Gross / Ded</span>
                          <span className="text-muted-foreground font-mono">
                            ₹{p.grossPay.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Days (LOP)</span>
                          <span className="font-medium text-foreground">
                            {p.presentDays}d {p.lopDays > 0 ? <span className="text-rose-500 font-bold">({p.lopDays} LOP)</span> : "(0 LOP)"}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end pt-0.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPayslipId(p.id)}
                          className="h-7 text-xs px-3 gap-1.5 rounded-lg w-full"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View Salary Slip</span>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop High-Density Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="py-2.5 px-3.5 text-left font-semibold">Pay Period</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Working Days</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Days Paid / LOP</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Gross Pay</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Total Deductions</th>
                    <th className="py-2.5 px-3.5 text-right font-semibold">Net Salary</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Status</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
                  {paginatedPayslips.map((p) => {
                    const statusVariant = p.paymentStatus === "PAID" ? "success" : "secondary";
                    return (
                      <tr key={p.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2 px-3.5">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {MONTH_NAMES[p.month - 1]} {p.year}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{p.payrollRun.title}</div>
                        </td>
                        <td className="py-2 px-3 text-center font-medium text-foreground">
                          {p.totalWorkingDays} Days
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-semibold text-foreground">{p.presentDays}</span>
                          {p.lopDays > 0 ? (
                            <span className="ml-1 text-rose-600 font-bold">({p.lopDays} LOP)</span>
                          ) : (
                            <span className="ml-1 text-emerald-600 font-medium">(0 LOP)</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-muted-foreground">
                          ₹{p.grossPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                          -₹{p.totalDeductions.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3.5 text-right font-bold text-foreground">
                          ₹{p.netPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={statusVariant} size="sm">{p.paymentStatus}</Badge>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPayslipId(p.id)}
                            className="h-6.5 text-[11px] px-2 gap-1 rounded-lg"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View Slip</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

      {/* Modal: Interactive & Printable Payslip Voucher */}
      <Modal
        isOpen={!!selectedPayslipId}
        onClose={() => setSelectedPayslipId(null)}
        title={
          detailedPayslip
            ? `Salary Voucher: ${MONTH_NAMES[detailedPayslip.month - 1]} ${detailedPayslip.year}`
            : "Salary Voucher"
        }
        description="Official earnings and deductions statement"
        maxWidth="lg"
      >
        <QueryState isLoading={loadingDetail} error={null}>
          {detailedPayslip && (
            <div className="space-y-4 pt-1 printable-area">
              {/* Top Quick Actions Bar (hidden in print) */}
              <div className="flex items-center justify-between pb-1 print:hidden">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Computer-generated official payslip
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs gap-1.5 w-full sm:w-auto justify-center font-medium">
                    <Printer className="h-3.5 w-3.5" />
                    Print / Download PDF
                  </Button>
                </div>
              </div>

              {/* Voucher Sheet */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 bg-white dark:bg-zinc-950 space-y-4 text-xs shadow-sm">
                {/* Voucher Status Bar */}
                <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
                  <div>
                    <span className="text-xs font-bold text-foreground tracking-wide uppercase">
                      Statement of Earnings
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Period: {MONTH_NAMES[detailedPayslip.month - 1]} {detailedPayslip.year}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={detailedPayslip.paymentStatus === "PAID" ? "success" : "secondary"} size="sm">
                      {detailedPayslip.paymentStatus}
                    </Badge>
                    {detailedPayslip.paymentReference && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        Ref: {detailedPayslip.paymentReference}
                      </div>
                    )}
                  </div>
                </div>

                {/* Employee & Bank Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 py-2 bg-zinc-50 dark:bg-zinc-900/60 p-3 sm:p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Employee</div>
                    <div className="font-bold text-foreground mt-0.5 truncate">
                      {detailedPayslip.person.firstName} {detailedPayslip.person.lastName}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{detailedPayslip.person.email}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Department</div>
                    <div className="font-medium text-foreground mt-0.5 truncate">
                      {detailedPayslip.person.department?.name || "General"}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {detailedPayslip.person.designation?.name || "Staff"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Attendance</div>
                    <div className="font-medium text-foreground mt-0.5">
                      {detailedPayslip.presentDays} / {detailedPayslip.totalWorkingDays} Days
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      LOP: <span className="font-semibold text-rose-600">{detailedPayslip.lopDays}d</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Bank / PAN</div>
                    <div className="font-medium text-foreground mt-0.5 truncate">
                      {(detailedPayslip.person as any).salaryAssignment?.bankAccount || detailedPayslip.person.bankAccount
                        ? `A/c: ****${((detailedPayslip.person as any).salaryAssignment?.bankAccount || detailedPayslip.person.bankAccount).slice(-4)}`
                        : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      PAN: {(detailedPayslip.person as any).salaryAssignment?.panNumber || detailedPayslip.person.panNumber || "—"}
                    </div>
                  </div>
                </div>

                {/* Two Column Itemized Table: Earnings vs Deductions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {/* Earnings */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="bg-zinc-50 dark:bg-zinc-900 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 font-bold text-foreground flex justify-between text-xs">
                      <span>Earnings</span>
                      <span>Amount (INR)</span>
                    </div>
                    <div className="p-3 space-y-2 text-xs">
                      {detailedPayslip.earnings.map((e, idx) => (
                        <div key={idx} className="flex justify-between items-center text-muted-foreground">
                          <span className="truncate pr-2">{e.name}</span>
                          <span className="font-medium text-foreground shrink-0">₹{e.amount.toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2 flex justify-between font-bold text-foreground">
                        <span>Total Gross Pay</span>
                        <span>₹{detailedPayslip.grossPay.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="bg-zinc-50 dark:bg-zinc-900 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 font-bold text-foreground flex justify-between text-xs">
                      <span>Deductions</span>
                      <span>Amount (INR)</span>
                    </div>
                    <div className="p-3 space-y-2 text-xs">
                      {detailedPayslip.deductions.map((d, idx) => (
                        <div key={idx} className="flex justify-between items-center text-muted-foreground">
                          <span className="truncate pr-2">{d.name}</span>
                          <span className="font-medium text-rose-600 dark:text-rose-400 shrink-0">
                            -₹{d.amount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2 flex justify-between font-bold text-foreground">
                        <span>Total Deductions</span>
                        <span className="text-rose-600 dark:text-rose-400">
                          -₹{detailedPayslip.totalDeductions.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Pay Callout */}
                <div className="p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Net Take-Home Salary
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-foreground mt-0.5">
                      ₹{detailedPayslip.netPay.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right italic">
                    Amount in words: <br className="hidden sm:inline" />
                    <span className="font-medium text-foreground not-italic">
                      {numberToWordsINR(detailedPayslip.netPay)}
                    </span>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="text-[10px] text-muted-foreground text-center border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
                  This is a computer-generated salary voucher and does not require a physical signature.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 print:hidden">
                <Button variant="outline" size="sm" onClick={() => setSelectedPayslipId(null)} className="h-8 px-4 text-xs font-medium">
                  Close
                </Button>
              </div>
            </div>
          )}
        </QueryState>
      </Modal>
    </div>
  );
}
