# ADR 0008 — Per-tenant theming via CSS variables, not per-tenant builds

## Context

White-labelling means each tenant can have its own primary colour and logo, and optionally hide
"powered by saas-erp" branding. The two realistic approaches are: build a separate frontend
bundle per tenant with its own theme baked in, or ship one bundle whose colours are set at
runtime.

## Decision

**One bundle, runtime theming via CSS custom properties.** Tailwind's colour tokens
(`apps/web/tailwind.config.ts`: `primary`, `background`, etc.) resolve to `hsl(var(--primary))`
and friends, not fixed hex values. `ThemeProvider` (`apps/web/src/theme/ThemeProvider.tsx`) fetches
the current tenant's `primaryColor` from `GET /admin/org` and writes it onto `<html>` as a CSS
variable on login — see `hex-to-hsl.ts` for the conversion (CSS variables use HSL triples, not
hex, so Tailwind's opacity modifiers like `bg-primary/50` work).

## Why not per-tenant builds

A separate build per tenant means a deploy pipeline that scales with the number of tenants, and
"which tenant's build is this bug even in" debugging. Runtime theming means: one deployed
frontend, tenant look-and-feel is just data (`Tenant.primaryColor` / `logoUrl` /
`showPoweredBy` in Postgres), changeable by the tenant's own Admin from the Organisation settings
screen with no deploy at all.

## Consequences

- Any new UI component must use the `primary`/`background`/`border`/etc. Tailwind tokens, never a
  hardcoded colour, or it won't pick up a tenant's branding.
- The component library referenced in the architecture decisions (shadcn/ui) is CSS-variable
  based by design, so components can be added incrementally (`npx shadcn add <component>`)
  without fighting this theming approach — see `apps/web/src/components/ui.tsx`'s note on what's
  hand-rolled today vs. what a real shadcn install would replace.
