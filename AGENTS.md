# AI Agent Instructions for SaaS ERP

## Core System Architecture & Aesthetics
- Monorepo using `pnpm` workspaces, NestJS backend (`apps/api`), React + Vite frontend (`apps/web`), Prisma ORM (`packages/db`).
- UI styling follows HeroUI aesthetics (`heroui.com`): curved borders (`rounded-xl`, `rounded-2xl`), smooth transitions, responsive micro-animations, flat & bordered button variants, dark/light theme support.
- Collapsible sidebar: Must always have prominent, accessible expand/uncollapse buttons (top header, floating border pill, footer, and mobile header).

## Mandatory Standard: Client-Friendly Error Handling
Whenever writing frontend or backend code:
1. **Never expose technical errors to the client**:
   - Never show raw JSON (`{"statusCode":500,"message":"Internal server error"}`), Prisma codes (`P2002`), SQL queries, or stack traces in toasts, modals, alerts, or forms.
2. **Short, Actionable, & Human-Understandable**:
   - State what happened in plain English without technical jargon.
   - Example duplicate: `"A record with this name already exists. Please choose a different one."`
   - Example not found: `"The requested item could not be found."`
   - Example 500: `"Something went wrong on the server. Please try again in a moment."`
3. **Backend (`apps/api`)**:
   - Always catch database constraint errors (such as Prisma `P2002` duplicate unique key, `P2025` record not found) and throw standard NestJS HTTP exceptions (`ConflictException`, `NotFoundException`) with human-friendly messages instead of letting them bubble up as unhandled HTTP 500s.
4. **Frontend (`apps/web`)**:
   - Always sanitize errors using `formatErrorMessage` from `apps/web/src/lib/error-formatter.ts`.
   - The API client (`apps/web/src/api/client.ts`) and `toast.error()` automatically wrap and sanitize any thrown error or status code.
