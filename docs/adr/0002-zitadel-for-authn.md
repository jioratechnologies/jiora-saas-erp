# ADR 0002 — Zitadel for authentication

## Context

The platform needs login, MFA, password policy, and session management, for a multi-tenant,
white-labelable product. Building this in-house is a lot of security-sensitive code to get right
and keep right. The realistic choices were: Zitadel, Keycloak, or Ory's stack (Kratos/Hydra).

## Decision

**Zitadel**, self-hosted (see `infra/docker-compose.yml`).

## Why

- **Native multi-tenancy.** Zitadel has a first-class "Organization" concept built in — it's
  designed for exactly this shape of product, rather than needing a realm/tenant model bolted on
  (as with Keycloak, where multi-tenancy is usually one realm per tenant, which gets unwieldy at
  scale).
- **Lighter and faster** than Keycloak (which is a large, Java/Quarkus-based system) for a
  platform that isn't itself Java-based.
- **One system, not three.** Ory's stack splits identity (Kratos), OAuth/OIDC (Hydra), and
  authorization (Keto) into separate services — more moving parts to run and reason about than
  this platform needs.
- OIDC/OAuth2 + PKCE support out of the box, which is what `apps/web` uses for browser login
  (via `oidc-client-ts` — Zitadel's own recommended SPA library).

## What Zitadel is (and isn't) responsible for

Zitadel answers **"who is this?"** only. It is not used to decide what a user can do — see ADR
0003. This keeps the identity provider swappable in principle (though not planned) without
touching any authorization logic.

## Consequences

- Every tenant's users log into the **same** Zitadel instance/OIDC client; Zitadel's
  Organization concept is what could separate them on Zitadel's side later (e.g. per-org login
  branding), not a separate deployment per tenant.
- The API only ever needs Zitadel's public JWKS endpoint to verify tokens
  (`ZITADEL_ISSUER` + `/oauth/v2/keys` — see `apps/api/src/auth/verify-token.ts`). It does not
  call Zitadel's management API in this pass — see the "not yet automated" note in
  `docs/onboarding/GETTING_STARTED.md`.
