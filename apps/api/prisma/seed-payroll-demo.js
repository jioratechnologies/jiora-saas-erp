/**
 * Additive, idempotent starter data for payroll to work out of the box.
 * Unlike prisma/seed.js it NEVER truncates or updates existing rows: it only
 * inserts what is missing.
 *
 *   node prisma/seed-payroll-demo.js            # dry run: prints what it would add
 *   node prisma/seed-payroll-demo.js --apply    # writes it
 *
 * Env: DIRECT_URL (required), SEED_TENANT_SLUG (optional; required when the
 * database has more than one tenant).
 *
 * Adds, per tenant:
 *  - a monthly salary (+ "Initial salary" revision) for every EMPLOYEE without
 *    one, by designation (placeholder amounts: edit them on the Compensation page)
 *  - the standard leave types (CL / SL / PL) when the tenant has none
 *  - fixed-date national holidays for 2026 and 2027 when missing
 */
const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const { PrismaClient } = require("@prisma/client");

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

// Placeholder monthly gross (INR) by designation name.
const GROSS_BY_DESIGNATION = {
  "Executive Director": 120000,
  "Finance Manager": 70000,
  "Lead Developer": 90000,
  "Software Engineer": 60000,
  "HR Executive": 45000,
  "Senior Accountant": 50000,
  "Operations Coordinator": 35000,
  "Volunteer Lead": 25000,
};
const DEFAULT_GROSS = 30000;

const LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave", annualQuota: 12 },
  { code: "SL", name: "Sick Leave", annualQuota: 10 },
  { code: "PL", name: "Privilege Leave", annualQuota: 15 },
];

const FIXED_HOLIDAYS = [
  ["01-26", "Republic Day"],
  ["05-01", "Labour Day"],
  ["08-15", "Independence Day"],
  ["10-02", "Gandhi Jayanti"],
  ["12-25", "Christmas"],
];
const HOLIDAY_YEARS = [2026, 2027];

const log = (msg) => console.log(`${APPLY ? "[apply]" : "[dry-run]"} ${msg}`);

async function seedTenant(tenant) {
  console.log(`\nTenant: ${tenant.name} (${tenant.slug})`);

  // 1. Salaries
  const people = await prisma.person.findMany({
    where: { tenantId: tenant.id, personType: "EMPLOYEE", status: { not: "EXITED" }, salaryAssignment: null },
    include: { designation: true },
    orderBy: { firstName: "asc" },
  });
  for (const p of people) {
    const gross = GROSS_BY_DESIGNATION[p.designation?.name ?? ""] ?? DEFAULT_GROSS;
    log(`salary: ${p.firstName} ${p.lastName} (${p.designation?.name ?? "no designation"}) -> ${gross}/month`);
    if (!APPLY) continue;
    await prisma.$transaction([
      prisma.employeeSalaryAssignment.create({
        data: { tenantId: tenant.id, personId: p.id, baseGross: gross, ctc: gross * 12, paymentMode: "BANK_TRANSFER" },
      }),
      prisma.salaryRevision.create({
        data: {
          tenantId: tenant.id,
          personId: p.id,
          oldGross: null,
          newGross: gross,
          effectiveDate: p.joiningDate ?? new Date(),
          remarks: "Initial salary (starter data)",
        },
      }),
    ]);
  }
  if (people.length === 0) console.log("salary: everyone already has a salary");

  // 2. Leave types (only when the tenant has none)
  const ltCount = await prisma.leaveType.count({ where: { tenantId: tenant.id } });
  if (ltCount === 0) {
    for (const lt of LEAVE_TYPES) {
      log(`leave type: ${lt.name} (${lt.annualQuota} days)`);
      if (APPLY) await prisma.leaveType.create({ data: { tenantId: tenant.id, ...lt, applicableTo: "ALL", isActive: true } });
    }
  } else {
    console.log(`leave types: ${ltCount} already exist`);
  }

  // 3. Fixed-date national holidays
  let addedHolidays = 0;
  for (const year of HOLIDAY_YEARS) {
    for (const [md, name] of FIXED_HOLIDAYS) {
      const date = new Date(`${year}-${md}T00:00:00.000Z`);
      const exists = await prisma.holiday.findFirst({ where: { tenantId: tenant.id, date } });
      if (exists) continue;
      addedHolidays++;
      log(`holiday: ${year}-${md} ${name}`);
      if (APPLY) await prisma.holiday.create({ data: { tenantId: tenant.id, name, date, isOptional: false } });
    }
  }
  if (addedHolidays === 0) console.log("holidays: nothing missing");
}

async function main() {
  if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is required.");
  const slug = process.env.SEED_TENANT_SLUG;
  const tenants = await prisma.tenant.findMany({ where: slug ? { slug } : {} });
  if (tenants.length === 0) throw new Error(slug ? `No tenant with slug "${slug}".` : "No tenants found.");
  if (!slug && tenants.length > 1) {
    throw new Error(`Several tenants found (${tenants.map((t) => t.slug).join(", ")}). Set SEED_TENANT_SLUG.`);
  }
  for (const t of tenants) await seedTenant(t);
  console.log(APPLY ? "\nDone." : "\nDry run only. Re-run with --apply to write.");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
