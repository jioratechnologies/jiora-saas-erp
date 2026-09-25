# auth/

Two guards, applied per-controller with `@UseGuards(ZitadelAuthGuard, PermissionsGuard)` — never
globally (the health check and `POST /auth/claim-invite` deliberately have neither).

- **ZitadelAuthGuard** — verifies the JWT against Zitadel's JWKS, then resolves the caller's app-
  side identity (tenant, roles, permissions) via the `auth_lookup_by_subject()` Postgres function
  and attaches it as `request.authContext`.
- **PermissionsGuard** — reads `@RequirePermission('some.key')` off the route and checks it
  against `authContext.permissionKeys`.

`ClaimInviteController` (`POST /auth/claim-invite`) is the odd one out: it runs *before* a user
has a resolved identity, by design — see `docs/adr/0003-postgres-rbac-for-authz.md` and the
comment in `claim-invite.controller.ts`.

Zitadel proves **who**; everything here past token verification is about **what they can do**,
which is looked up from our own tables, not Zitadel's. See
`docs/adr/0002-zitadel-for-authn.md` / `0003-postgres-rbac-for-authz.md`.
