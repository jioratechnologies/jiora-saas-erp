# ADR 0003 — Postgres tables (not Zitadel) for authorization

## Context

The platform needs: three fixed platform-level roles (`super_admin`, `developer`, `maintainer`),
one fixed per-tenant role (`admin`, the org owner, seeded automatically), and **fully custom
per-tenant roles** that a tenant's `admin` builds themselves from a fixed permission catalog (the
"Role Builder" — see `apps/web/src/routes/AdminRolesPage.tsx`).

## Decision

Authorization lives entirely in our own Postgres tables (`roles`, `permissions` catalog code,
`role_permissions`, `user_roles` — see `prisma/schema.prisma`), not in Zitadel's own role/project
model.

## Why not use Zitadel's roles

Zitadel can attach roles/authorizations to a user via its Projects feature, and that's a
reasonable fit for a fixed, small set of roles. It's a poor fit for "any tenant admin can invent
an arbitrary named role with an arbitrary subset of ~20 permissions" — that's application data
(rows a tenant admin creates through a UI), not identity-provider configuration. Keeping it in
our own tables also means:

- Permission checks are a **plain SQL join** (`user_roles` → `role_permissions`), which is fast,
  easy to reason about, and composes naturally with Postgres RLS (ADR 0001).
- No round-trip to Zitadel is needed on every request to know what a user can do — see ADR 0002's
  "who vs what" split.
- The permission catalog is **code** (`packages/permissions`), not data — adding a new
  permission ships with a deploy, and both `apps/api` (enforcement) and `apps/web` (the Role
  Builder UI) import the exact same list, so they can never drift apart.

## Consequences

- Zitadel proves identity (the JWT `sub` claim); `ZitadelAuthGuard` then looks up that identity's
  tenant + roles + permissions from Postgres via the `auth_lookup_by_subject()` SQL function (see
  ADR 0007's sibling note on why that lookup needs a `SECURITY DEFINER` function).
- If Zitadel were ever replaced, only the identity-verification step
  (`apps/api/src/auth/verify-token.ts`) would need to change — none of the authorization model.
