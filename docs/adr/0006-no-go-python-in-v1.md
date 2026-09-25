# ADR 0006 — No Go or Python in v1

## Context

Go and Python were both considered for the backend, or for specific workers (e.g. heavy
PDF/Excel report generation, OCR on uploaded documents).

## Decision

**Not used in this pass.** The backend is Node.js + TypeScript (NestJS) only — see the repo's
top-level architecture table for the full stack decision.

## Why

Every extra language in a stack is an extra runtime to deploy, monitor, and staff for, and extra
context-switching for anyone (including a fresher) trying to trace a request end to end. Adding
Go or Python before there's a *specific, measured* reason (e.g. "report generation blocks the
Node event loop for 8 seconds under load") would be paying that cost speculatively.

## When to revisit

If a specific, measured bottleneck shows up — most likely candidates are heavy document
generation/OCR — it becomes a **worker service** (its own container, called via a job queue on
Valkey/BullMQ, not a synchronous in-process call), so it can be added without restructuring the
rest of the platform. That's a new ADR when/if it happens, with the actual measurement that
justified it.

## Consequences

- No polyglot build tooling, CI matrix, or dependency management overhead in v1.
- `docs/onboarding/GETTING_STARTED.md` only needs to cover one language runtime for a new
  engineer to be productive.
