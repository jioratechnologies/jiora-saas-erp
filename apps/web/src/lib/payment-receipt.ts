import { escapeHtml, printHtml } from "./print-html";
import { fullName } from "./input-constraints";

export interface ReceiptOrg {
  name: string;
  logoUrl?: string | null;
}

interface ReceiptPerson {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string;
  department?: { name: string } | null;
}

export interface ClaimReceiptData {
  id: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  description?: string;
  settlementReference?: string;
  person: ReceiptPerson;
}

export interface AdvanceReceiptData {
  id: string;
  amountRequested: number;
  amountApproved?: number | null;
  reason: string;
  tenureMonths: number;
  monthlyDeduction: number;
  amountRecovered: number;
  decidedAt?: string | null;
  createdAt: string;
  person: ReceiptPerson;
}

const CSS = `
.rc{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;line-height:1.5;padding:20px;max-width:720px;margin:0 auto}
.rc .hd{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px}
.rc .org{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700}
.rc .org img{height:34px;width:34px;object-fit:contain}
.rc .ttl{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.rc table{width:100%;border-collapse:collapse;margin-top:14px}
.rc td{padding:7px 4px;border-bottom:1px solid #e5e5e5;vertical-align:top}
.rc td:first-child{color:#666;width:38%}
.rc td:last-child{font-weight:600}
.rc .amt{margin-top:16px;display:flex;justify-content:space-between;align-items:center;border:2px solid #111;border-radius:8px;padding:12px 16px;font-size:16px;font-weight:700}
.rc .note{margin-top:14px;font-size:11px;color:#555}
.rc .sig{display:flex;justify-content:space-between;margin-top:56px;font-size:11px;color:#444}
.rc .sig div{border-top:1px solid #111;padding-top:4px;min-width:170px;text-align:center}
.rc .foot{margin-top:22px;text-align:center;font-size:10px;color:#888}
`;

const inr = (n: number | null | undefined) => `₹ ${(n ?? 0).toLocaleString("en-IN")}`;
const day = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-IN") : "-");

function absUrl(url?: string | null): string {
  if (!url) return "";
  return /^https?:/i.test(url) ? url : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function shell(org: ReceiptOrg, title: string, rows: [string, string][], amountLabel: string, amount: number, note: string) {
  const e = escapeHtml;
  const logo = absUrl(org.logoUrl);
  return `<div class="rc">
<div class="hd"><div class="org">${logo ? `<img src="${e(logo)}" alt="">` : ""}<span>${e(org.name)}</span></div><div class="ttl">${e(title)}</div></div>
<table>${rows.map(([k, v]) => `<tr><td>${e(k)}</td><td>${e(v || "-")}</td></tr>`).join("")}</table>
<div class="amt"><span>${e(amountLabel)}</span><span>${inr(amount)}</span></div>
<div class="note">${e(note)}</div>
<div class="sig"><div>Employee signature</div><div>Authorised signatory</div></div>
<div class="foot">Computer generated receipt. This is separate from your salary slip.</div>
</div>`;
}

export function printClaimReceipt(c: ClaimReceiptData, org: ReceiptOrg): void {
  const html = shell(
    org,
    "Reimbursement Receipt",
    [
      ["Receipt no.", c.settlementReference || c.id.slice(0, 8).toUpperCase()],
      ["Employee", fullName(c.person)],
      ["Department", c.person.department?.name ?? ""],
      ["Claim", c.title],
      ["Category", c.category],
      ["Expense date", day(c.expenseDate)],
      ["Details", c.description ?? ""],
    ],
    "Amount reimbursed",
    c.amount,
    "This reimbursement is paid separately and is not part of the salary slip.",
  );
  printHtml(`Reimbursement_Receipt_${fullName(c.person).replace(/\s+/g, "_")}`, html, CSS);
}

export function printAdvanceReceipt(a: AdvanceReceiptData, org: ReceiptOrg): void {
  const approved = a.amountApproved ?? a.amountRequested;
  const html = shell(
    org,
    "Salary Advance Receipt",
    [
      ["Receipt no.", a.id.slice(0, 8).toUpperCase()],
      ["Employee", fullName(a.person)],
      ["Department", a.person.department?.name ?? ""],
      ["Reason", a.reason],
      ["Approved on", day(a.decidedAt ?? a.createdAt)],
      ["Repayment", `${a.tenureMonths} month(s) at ${inr(a.monthlyDeduction)} per month`],
      ["Recovered so far", inr(a.amountRecovered)],
      ["Balance to recover", inr(Math.max(0, approved - a.amountRecovered))],
    ],
    "Advance amount",
    approved,
    "This advance is issued separately. Only the monthly repayment appears on the salary slip.",
  );
  printHtml(`Advance_Receipt_${fullName(a.person).replace(/\s+/g, "_")}`, html, CSS);
}
