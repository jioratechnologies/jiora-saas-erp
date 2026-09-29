# ADR 0004 — Valkey instead of Redis

> **Superseded by [ADR 0009](0009-redis-over-valkey.md).** Kept for history —
> the reasoning below was correct at the time, but the project reverted to
> Redis; see 0009 for why.

## Context

The platform needs an in-memory store for job queues, caching, and rate limiting.

## Decision

**Valkey** (`valkey/valkey` image, Redis-protocol-compatible), not Redis itself.

## Why

Redis changed its license in 2024 away from the permissive, fully open-source BSD terms it used
to ship under. Valkey is the community fork that continues under the original open-source terms,
governed by the Linux Foundation, and is a drop-in protocol replacement — every Redis client
library, including BullMQ (used for the job queue), works against it unchanged.

## Consequences

- Anywhere docs or code say "Redis-compatible," they mean Valkey is the thing actually running
  (`infra/docker-compose.yml`, service `valkey`, mapped to host port 6380 — see
  `docs/onboarding/GETTING_STARTED.md` for why the port isn't the Redis default 6379).
- No application code changes if the team ever needed to point at a different
  Redis-protocol-compatible service — the client libraries don't know the difference.
