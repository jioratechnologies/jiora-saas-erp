/**
 * Moves the app's existing users to a NEW Zitadel instance.
 *
 * The app identifies a person by the Zitadel user id stored in
 * users.zitadel_subject_id (the JWT `sub`). A new Zitadel has new user ids, so
 * every existing user needs (1) an account in the new Zitadel and (2) their
 * zitadel_subject_id pointing at that account. Roles, designations and people
 * records are untouched.
 *
 *   node prisma/migrate-users-to-zitadel.js              # dry run: reads DB + Zitadel, writes nothing
 *   node prisma/migrate-users-to-zitadel.js --create     # also creates missing users in Zitadel
 *   node prisma/migrate-users-to-zitadel.js --create --link
 *                                                        # also writes users.zitadel_subject_id (after a JSON backup)
 *
 * Env (never printed):
 *   DIRECT_URL        owner connection to the app database
 *   ZITADEL_URL       base URL of the new Zitadel (defaults to ZITADEL_ISSUER)
 *   ZITADEL_PAT       personal access token of a Zitadel machine user allowed to read/create users
 *   ZITADEL_ORG_ID    optional: organisation id new users are created in
 *   SEED_TENANT_SLUG  optional: only this tenant (platform users are included when unset)
 *
 * New users are created with a verified email and NO password. Each person sets
 * their own password through "Forgot password" on the Zitadel login page, which
 * needs SMTP configured in the new Zitadel (Console > Settings > SMTP).
 * Idempotent: users that already exist in Zitadel (matched by email) are reused.
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

const CREATE = process.argv.includes("--create");
const LINK = process.argv.includes("--link");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const ZITADEL_URL = (process.env.ZITADEL_URL || process.env.ZITADEL_ISSUER || "").replace(/\/+$/, "");
const PAT = process.env.ZITADEL_PAT || "";

async function z(method, pathname, body) {
  const res = await fetch(`${ZITADEL_URL}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg = json?.message || json?.error || text.slice(0, 200);
    throw new Error(`Zitadel ${method} ${pathname} -> ${res.status}: ${msg}`);
  }
  return json;
}

async function findByEmail(email) {
  const out = await z("POST", "/v2/users", {
    queries: [{ emailQuery: { emailAddress: email, method: "TEXT_QUERY_METHOD_EQUALS_IGNORE_CASE" } }],
  });
  const hit = (out?.result || []).find((u) => u.human?.email?.email?.toLowerCase() === email.toLowerCase());
  return hit ? { userId: hit.userId, verified: !!hit.human?.email?.isVerified } : null;
}

function splitName(displayName, email) {
  const parts = (displayName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { given: email.split("@")[0], family: "-" };
  if (parts.length === 1) return { given: parts[0], family: "-" };
  return { given: parts[0], family: parts.slice(1).join(" ") };
}

async function createUser(u) {
  const { given, family } = splitName(u.displayName, u.email);
  const body = {
    username: u.email,
    profile: { givenName: given, familyName: family, displayName: u.displayName || u.email },
    email: { email: u.email, isVerified: true },
  };
  if (process.env.ZITADEL_ORG_ID) body.organization = { orgId: process.env.ZITADEL_ORG_ID };
  const out = await z("POST", "/v2/users/human", body);
  return out.userId;
}

async function main() {
  if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is required.");
  if (!ZITADEL_URL || !PAT) throw new Error("ZITADEL_URL and ZITADEL_PAT are required.");
  if (LINK && !CREATE) console.log("Note: --link without --create only links users that already exist in Zitadel.");

  const slug = process.env.SEED_TENANT_SLUG;
  const where = { deactivatedAt: null, ...(slug ? { tenant: { slug } } : {}) };
  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, displayName: true, zitadelSubjectId: true, tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Users to process: ${users.length} (active only)\n`);

  const plan = [];
  for (const u of users) {
    const existing = await findByEmail(u.email);
    let action;
    if (existing) action = existing.userId === u.zitadelSubjectId ? "already-linked" : "link-existing";
    else action = CREATE ? "create+link" : "needs-create";
    plan.push({ user: u, existing, action });
    console.log(`${(CREATE ? "[create]" : "[dry-run]").padEnd(9)} ${u.email.padEnd(38)} ${action}`);
  }

  if (!CREATE && !LINK) {
    console.log("\nDry run only. Use --create to create missing Zitadel users, --link to write subject ids.");
    return;
  }

  const resolved = [];
  for (const p of plan) {
    if (p.action === "already-linked") continue;
    let newId = p.existing?.userId;
    if (!newId && CREATE) newId = await createUser(p.user);
    if (newId) resolved.push({ id: p.user.id, email: p.user.email, oldSubject: p.user.zitadelSubjectId, newSubject: newId });
  }
  console.log(`\nResolved ${resolved.length} user(s) in Zitadel.`);

  if (!LINK) {
    console.log("Not linked. Re-run with --link to point users.zitadel_subject_id at the new accounts.");
    return;
  }

  const backup = path.resolve(process.cwd(), `zitadel-subject-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backup, JSON.stringify(resolved, null, 2), { mode: 0o600 });
  console.log(`Backup of old -> new subject ids written to ${backup} (keep it until the cutover is verified).`);

  for (const r of resolved) {
    await prisma.user.update({ where: { id: r.id }, data: { zitadelSubjectId: r.newSubject } });
  }
  console.log(`Linked ${resolved.length} user(s). Switch the app to the new Zitadel (issuer, project id, client id) now.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
