# ADR 0009 — Redis instead of Valkey

## Context

[ADR 0004](0004-valkey-over-redis.md) picked Valkey over Redis for licensing
reasons. The project has since switched back to Redis.

## Decision

**Redis** (`redis` image), not Valkey.

## Why

Direct team decision — not a reversal of the licensing concern ADR 0004
raised, which still stands: Redis's licensing terms since 2024 are less
permissive than Valkey's. Anyone relying on this service under the older,
fully open-source BSD terms should confirm Redis's current license still
fits their use case.

## Consequences

- Anywhere docs or code say "Redis," it's the real thing now, not a
  protocol-compatible fork — no client-library changes either way, since
  `ioredis` (used in `apps/api/src/cache/cache.service.ts`) talks the same
  wire protocol to both.
- Service name changed from `valkey` to `redis` everywhere (compose files,
  `REDIS_URL` env var — was `VALKEY_URL`) — see `infra/docker-compose.yaml`,
  `infra/docker-compose.production.yaml`.
- The licensing tradeoff ADR 0004 avoided is back in play. Revisit if it
  becomes a real constraint (e.g., commercial redistribution terms).
