# ADR 0010 — Designation-based access control

## Context

The system previously used free-standing custom roles (HR, Developer, Employee) that a tenant admin could create and assign to individual users through the Role Builder UI. This added cognitive overhead: admins had to think separately about "who has what job title" (designation) and "who has what permissions" (role).

In practice, designations (Job Title, Manager, Accountant, etc.) are the primary organizational structure. Permissions should flow from the designation a user holds, not be independently assigned. Moreover, adding permissions to a new role should automatically apply to anyone with that designation—today, an HR manager must manually grant the role to each employee.

## Decision

Each `Designation` entity now owns exactly one `Role` via a foreign key `role_id` with cascade delete. When a user is assigned a designation, they inherit that role's permissions. Platform-level users holding the global `admin` role also receive the tenant's base `admin` role. At login, `ZitadelAuthGuard` aggregates permissions from all user roles (designation roles + user-assigned roles) and includes self-service permissions from `SELF_SERVICE_PERMISSION_KEYS` in the JWT context.

Assignment of a designation requires the caller to hold the org `admin` role OR already possess all permissions of the designation being assigned—enforced by `assertCanAssignDesignation()` in `rbac.service.ts`. Users cannot assign designations to themselves.

The Access Control Page (renamed from Roles) displays only module cards with designation bindings and a single Grant Access button. Permission keys are no longer shown to the admin.

## Why not keep free-standing roles

Free-standing roles create a many-to-many mapping between designations and permissions that must be maintained separately. This leads to:

- **Stale permissions**: Adding a new permission to the HR role does not automatically apply to users with the HR designation; an admin must manually re-grant.
- **Cognitive load**: Admins reason separately about job structure (designation) and permissions (role), often leading to inconsistent assignments.
- **Redundant UI**: Role Builder as a separate page with custom role creation, when in fact "role" is just the permission set of a designation.

## Consequences

- **Permission propagation**: All users with a designation automatically gain new permissions added to that designation's role, without manual re-assignment.
- **Simpler Access Control Page**: Single "Grant Access" action per user, no custom role creation. Module cards show which designations hold which permissions.
- **Migration required**: Old free-standing roles (HR, Developer, Employee) are retired. A one-time migration (`20261004000000_designation_access`) copies permissions from role holders to corresponding designation roles, preserving all granted access.
- **Invite UX**: User invite flow simplified to designation dropdown + optional Organisation admin checkbox; no role selection.
- **Database schema**: `Designation` gains `role_id` FK; `roles` table retains `designation_id` to enforce one-to-one link. Cascade delete ensures deleting a designation also deletes its role.

---
