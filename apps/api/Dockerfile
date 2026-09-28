# Multi-stage build for the NestJS API. Built with the monorepo root as
# context (see infra/docker-compose.*.yml — `context: ..` relative to this
# file, or `.` from the repo root), because it needs the workspace's
# pnpm-lock.yaml and the packages/ workspace deps, not just apps/api alone.

FROM node:20-slim AS base
# node:20-slim has no `openssl` binary — Prisma's engine-selection code shells
# out to it to detect the OpenSSL version and picks the wrong engine binary
# without it (silent "Schema engine error:" crash at `prisma generate` time
# and again at `prisma migrate deploy` time, since detection reruns each call).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# --- deps: install once, reused by build and (via prune) by the runtime stage ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/permissions/package.json packages/permissions/package.json
RUN pnpm install --frozen-lockfile

# --- build: compile TS -> dist, generate the Prisma client ---
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @saas-erp/shared-types build \
 && pnpm --filter @saas-erp/permissions build \
 && pnpm --filter @saas-erp/api exec prisma generate \
 && pnpm --filter @saas-erp/api build

# --- runtime ---
# Copies the whole built workspace rather than cherry-picking node_modules:
# pnpm's symlinked store means each package needs its own node_modules/
# alongside the shared root one, and copying selectively is easy to get
# subtly wrong. Simpler and correct costs a bit of image size here.
FROM node:20-slim AS runtime
# Same openssl fix as the base stage above — this stage starts fresh from
# node:20-slim, doesn't inherit it.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
WORKDIR /repo/apps/api
EXPOSE 3000
# Applies pending migrations before every start — safe to run on an
# already-up-to-date database (Prisma no-ops), required on a fresh one.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
