import type { Permission } from "@saas-erp/shared-types";

/**
 * The full permission catalog. This is the ONLY place permission keys are
 * defined — tenant Admins build custom roles by picking from this list via
 * the Role Builder UI; they can never invent new keys.
 *
 * Naming: "<module>.<resource>.<action>"
 *
 * Grows module by module as each phase is implemented. Phase 0+1 only
 * needs the "platform" and "admin" groups below — HR/Finance/Projects/CRM
 * permission keys are added when those modules are built (Phase 2+).
 */
export const PERMISSION_CATALOG: Permission[] = [
  // Platform-level — only assignable to platform roles (super_admin/developer/maintainer),
  // never to a tenant-scoped custom role.
  { key: "platform.tenant.read", description: "View any tenant", module: "platform" },
  { key: "platform.tenant.write", description: "Create/edit any tenant", module: "platform" },
  { key: "platform.tenant.suspend", description: "Suspend/reinstate any tenant", module: "platform" },
  { key: "platform.tenant.impersonate", description: "Log in as a user within any tenant for support", module: "platform" },

  // Admin module (Foundation & Admin, Phase 1) — tenant-scoped, assignable via Role Builder.
  { key: "admin.org.read", description: "View organisation profile and settings", module: "admin" },
  { key: "admin.org.write", description: "Edit organisation profile, theme and branding", module: "admin" },
  { key: "admin.department.read", description: "View departments", module: "admin" },
  { key: "admin.department.write", description: "Create/edit departments", module: "admin" },
  { key: "admin.department.delete", description: "Delete departments", module: "admin" },
  { key: "admin.designation.read", description: "View designations", module: "admin" },
  { key: "admin.designation.write", description: "Create/edit designations", module: "admin" },
  { key: "admin.designation.delete", description: "Delete designations", module: "admin" },
  { key: "admin.role.read", description: "View roles and their permissions", module: "admin" },
  { key: "admin.role.write", description: "Create/edit custom roles (Role Builder)", module: "admin" },
  { key: "admin.role.delete", description: "Delete a non-protected custom role", module: "admin" },
  { key: "admin.user.read", description: "View users in the organisation", module: "admin" },
  { key: "admin.user.invite", description: "Invite a new user", module: "admin" },
  { key: "admin.user.write", description: "Edit a user's profile or role assignment", module: "admin" },
  { key: "admin.user.deactivate", description: "Deactivate a user", module: "admin" },

  // HR Module (Phase 2: HR Core) — tenant-scoped, assignable via Role Builder.
  { key: "hr.person.read", description: "View employee and volunteer directory", module: "hr" },
  { key: "hr.person.write", description: "Create/edit employee and volunteer profiles and upload documents", module: "hr" },
  { key: "hr.person.exit", description: "Process resignation, exit checklist, and record closure", module: "hr" },
  { key: "hr.attendance.checkin", description: "Submit daily and remote check-in / check-out", module: "hr" },
  { key: "hr.attendance.read", description: "View attendance records and logs", module: "hr" },
  { key: "hr.attendance.manage", description: "Regularize or modify attendance logs", module: "hr" },
  { key: "hr.leave.apply", description: "Submit leave requests", module: "hr" },
  { key: "hr.leave.read", description: "View leave balances and request status", module: "hr" },
  { key: "hr.leave.approve", description: "Approve or reject subordinate leave requests", module: "hr" },
  { key: "hr.holiday.read", description: "View annual holiday calendar", module: "hr" },
  { key: "hr.holiday.write", description: "Manage holiday calendar and leave types", module: "hr" },

  // Payroll & Claims Module (Phase 3) — tenant-scoped, assignable via Role Builder.
  { key: "payroll.salary.read", description: "View salary components, structures, and compensation records", module: "payroll" },
  { key: "payroll.salary.manage", description: "Create/edit salary components, templates, and employee assignments", module: "payroll" },
  { key: "payroll.run.read", description: "View monthly payroll runs and registers", module: "payroll" },
  { key: "payroll.run.manage", description: "Execute monthly payroll calculations, approve runs, and disburse", module: "payroll" },
  { key: "payroll.payslip.read", description: "View and download employee payslips", module: "payroll" },
  { key: "payroll.claim.apply", description: "Submit expense and travel reimbursement claims", module: "payroll" },
  { key: "payroll.claim.read", description: "View expense and reimbursement claims", module: "payroll" },
  { key: "payroll.claim.manage", description: "Approve, reject, and disburse expense claims", module: "payroll" },
  { key: "payroll.advance.apply", description: "Submit emergency salary advance requests", module: "payroll" },
  { key: "payroll.advance.manage", description: "Review and approve/reject salary advances", module: "payroll" },
];

export const PLATFORM_ONLY_MODULES = ["platform"] as const;

export function isPlatformPermission(key: string): boolean {
  return key.startsWith("platform.");
}

export function getPermission(key: string): Permission | undefined {
  return PERMISSION_CATALOG.find((p) => p.key === key);
}
