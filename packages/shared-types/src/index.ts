/**
 * Types shared between apps/api and apps/web. Kept dependency-free
 * (no Prisma, no NestJS, no React) so both sides can import it directly.
 */

/** The three platform-level roles. Cross-tenant, not tied to any single org. */
export type PlatformRole = "super_admin" | "developer" | "maintainer";

/** The one role every tenant gets automatically, seeded at tenant creation. Cannot be deleted. */
export const TENANT_OWNER_ROLE = "admin" as const;

/** Matches the flat shape of the Tenant Prisma model / API response exactly — no nested "theme" object. */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  primaryColor: string;
  logoUrl: string | null;
  showPoweredBy: boolean;
  createdAt: string;
  suspendedAt: string | null;
}

export interface Permission {
  /** e.g. "hr.employee.read" — dot-namespaced module.resource.action */
  key: string;
  description: string;
  module: string;
}

export interface Role {
  id: string;
  tenantId: string | null; // null for platform roles (super_admin/developer/maintainer)
  name: string;
  isProtected: boolean; // true for the seeded "admin" tenant-owner role
  permissionKeys: string[];
}

export interface AppUser {
  id: string;
  tenantId: string | null; // null for platform users
  zitadelSubjectId: string | null; // null until the invite is claimed on first login
  email: string;
  displayName: string;
  roleIds: string[];
}
