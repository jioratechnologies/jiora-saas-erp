import { useMemo } from "react";
import { Download, Printer, FileDown } from "lucide-react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { toast } from "../ui/toast";
import { fullName } from "../../lib/input-constraints";
import { formatErrorMessage } from "../../lib/error-formatter";
import { exportToExcel } from "../../lib/excel-export";
import { escapeHtml, printHtml } from "../../lib/print-html";

export interface VoucherLine {
  code?: string;
  name: string;
  amount: number;
}

export interface PayslipDetail {
  id: string;
  year: number;
  month: number;
  earnings: VoucherLine[];
  deductions: VoucherLine[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paymentStatus?: string;
  calcSummary?: {
    baseGross?: number;
    expectedDays?: number;
    paidDays?: number;
    unpaidDays?: number;
    perDayRate?: number;
    lopAmount?: number;
    earnedGross?: number;
    workedHours?: number;
  } | null;
  person: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
    department?: { name: string } | null;
    designation?: { name: string } | null;
    bankAccount?: string | null;
    bankIfsc?: string | null;
    panNumber?: string | null;
    joiningDate?: string | null;
  };
}

export interface VoucherOrg {
  name: string;
  logoUrl?: string | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below100(n: number): string {
  return n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? below100(r) : ""].filter(Boolean).join(" ");
}

/** Indian numbering (lakh / crore), e.g. 123456.5 -> "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only". */
export function amountInWords(amount: number): string {
  const total = Math.round(Math.abs(amount) * 100);
  let rupees = Math.floor(total / 100);
  const paise = total % 100;
  if (rupees === 0 && paise === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000);
  rupees %= 100000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rupees) parts.push(below1000(rupees));
  const r = parts.join(" ");
  return `Rupees ${r || "Zero"}${paise ? ` and ${below100(paise)} Paise` : ""} Only`;
}

const inr = (n: number | undefined | null) =>
  (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CSS = `
.sv{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;line-height:1.45;background:#fff;padding:20px;box-sizing:border-box;width:100%}
.sv *{box-sizing:border-box}
.sv .hd{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:2px solid #111;padding-bottom:10px}
.sv .org{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700}
.sv .org img{height:42px;max-width:120px;object-fit:contain}
.sv .ttl{font-size:14px;font-weight:700;text-align:right}
.sv .box{border:1px solid #bbb;border-radius:4px;margin-top:12px}
.sv .box h4{margin:0;padding:5px 10px;background:#f2f2f2;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid #bbb}
.sv .kv{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 16px;padding:8px 10px}
.sv .kv.c4{grid-template-columns:repeat(4,1fr)}
.sv .kv span{display:block;color:#666;font-size:10px}
.sv .kv b{font-weight:600}
.sv .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.sv .cols .box{margin-top:0}
.sv table{width:100%;border-collapse:collapse}
.sv td{padding:5px 10px;border-bottom:1px solid #eee}
.sv td.n{text-align:right;white-space:nowrap}
.sv tr.tot td{font-weight:700;border-top:1px solid #111;border-bottom:0;background:#fafafa}
.sv .net{margin-top:12px;border:2px solid #111;border-radius:4px;padding:10px 12px;display:flex;justify-content:space-between;gap:12px;align-items:center}
.sv .net b{font-size:16px}
.sv .words{margin-top:6px;font-size:11px}
.sv .sig{display:flex;justify-content:space-between;margin-top:46px;font-size:11px}
.sv .sig div{border-top:1px solid #111;padding-top:4px;min-width:140px;text-align:center}
.sv .foot{margin-top:18px;text-align:center;color:#666;font-size:10px}
@media (max-width:560px){.sv .kv.c4{grid-template-columns:repeat(2,1fr)}.sv .cols{grid-template-columns:1fr}.sv .hd{flex-direction:column;align-items:flex-start}.sv .ttl{text-align:left}}
`;

function absUrl(u?: string | null): string {
  if (!u) return "";
  try {
    return new URL(u, window.location.origin).href;
  } catch {
    return "";
  }
}

function buildVoucherHtml(p: PayslipDetail, org: VoucherOrg): string {
  const e = escapeHtml;
  const cs = p.calcSummary ?? {};
  const per = p.person;
  const title = `Salary Slip - ${MONTHS[p.month - 1]} ${p.year}`;
  const logo = absUrl(org.logoUrl);
  const kv = (k: string, v?: string | number | null) => `<div><span>${e(k)}</span><b>${e(v || "-")}</b></div>`;
  const rows = (lines: VoucherLine[]) =>
    lines.length
      ? lines.map((l) => `<tr><td>${e(l.name)}</td><td class="n">${inr(l.amount)}</td></tr>`).join("")
      : `<tr><td colspan="2" style="color:#888">-</td></tr>`;
  const joined = per.joiningDate ? new Date(per.joiningDate).toLocaleDateString("en-IN") : "";

  return `<div class="sv">
<div class="hd"><div class="org">${logo ? `<img src="${e(logo)}" alt="">` : ""}<span>${e(org.name)}</span></div><div class="ttl">${e(title)}</div></div>
<div class="box"><h4>Employee</h4><div class="kv c4">
${kv("Name", fullName(per))}${kv("Department", per.department?.name)}${kv("Designation", per.designation?.name)}${kv("Date of joining", joined)}
${kv("PAN", per.panNumber)}${kv("Bank account", per.bankAccount)}${kv("IFSC", per.bankIfsc)}${kv("Payment status", p.paymentStatus)}
</div></div>
<div class="box"><h4>Attendance</h4><div class="kv c4">
${kv("Expected days", cs.expectedDays)}${kv("Paid days", cs.paidDays)}${kv("Unpaid days", cs.unpaidDays)}${kv("Per-day rate", cs.perDayRate != null ? inr(cs.perDayRate) : "")}
${kv("Hours worked", cs.workedHours)}
</div></div>
<div class="cols">
<div class="box"><h4>Earnings</h4><table>${rows(p.earnings)}<tr class="tot"><td>Gross earnings</td><td class="n">${inr(p.grossPay)}</td></tr></table></div>
<div class="box"><h4>Deductions</h4><table>${rows(p.deductions)}<tr class="tot"><td>Total deductions</td><td class="n">${inr(p.totalDeductions)}</td></tr></table></div>
</div>
<div class="net"><span>Net pay</span><b>&#8377; ${inr(p.netPay)}</b></div>
<div class="words"><b>In words:</b> ${e(amountInWords(p.netPay))}</div>
<div class="sig"><div>Employee signature</div><div>Authorised signatory</div></div>
<div class="foot">Computer generated slip. No signature required.</div>
</div>`;
}

function fileBase(p: PayslipDetail): string {
  return `Salary_Slip_${fullName(p.person).replace(/\s+/g, "_")}_${MONTHS[p.month - 1]}_${p.year}`;
}

/** A4 salary slip. Paper-style (always light) so screen and print match. */
export function SalaryVoucher({ payslip, org }: { payslip: PayslipDetail; org: VoucherOrg }) {
  const html = useMemo(() => buildVoucherHtml(payslip, org), [payslip, org]);
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white">
      <style>{CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function SalaryVoucherDialog({
  isOpen,
  onClose,
  payslip,
  loading,
  org,
}: {
  isOpen: boolean;
  onClose: () => void;
  payslip?: PayslipDetail | null;
  loading?: boolean;
  org: VoucherOrg;
}) {
  const print = () => {
    if (!payslip) return;
    try {
      printHtml(fileBase(payslip), buildVoucherHtml(payslip, org), CSS);
    } catch (err) {
      toast.error(formatErrorMessage(err));
    }
  };

  const download = async () => {
    if (!payslip) return;
    try {
      const cs = payslip.calcSummary ?? {};
      const rows: (string | number)[][] = [
        ["Employee", fullName(payslip.person), ""],
        ["Period", `${MONTHS[payslip.month - 1]} ${payslip.year}`, ""],
        ["Expected days", cs.expectedDays ?? "", ""],
        ["Paid days", cs.paidDays ?? "", ""],
        ["Unpaid days", cs.unpaidDays ?? "", ""],
        ["Per-day rate", cs.perDayRate ?? "", ""],
        ...payslip.earnings.map((l) => ["Earning", l.name, l.amount]),
        ["Gross", "", payslip.grossPay],
        ...payslip.deductions.map((l) => ["Deduction", l.name, l.amount]),
        ["Total deductions", "", payslip.totalDeductions],
        ["Net pay", amountInWords(payslip.netPay), payslip.netPay],
      ];
      await exportToExcel(fileBase(payslip), ["Type", "Item", "Amount (INR)"], rows, "Salary Slip");
    } catch (err) {
      toast.error(formatErrorMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Salary slip"
      maxWidth="4xl"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={print} disabled={!payslip} className="gap-1.5 text-xs h-8">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button size="sm" variant="outline" onClick={print} disabled={!payslip} className="gap-1.5 text-xs h-8">
            <FileDown className="h-3.5 w-3.5" /> Save as PDF
          </Button>
          <Button size="sm" variant="outline" onClick={download} disabled={!payslip} className="gap-1.5 text-xs h-8">
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
          <span className="text-[11px] text-muted-foreground">For PDF, choose "Save as PDF" in the print window.</span>
        </div>
        {loading || !payslip ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <div className="mx-auto w-full max-w-[794px]">
              <SalaryVoucher payslip={payslip} org={org} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
