# Multi-stage build for the React/Vite frontend. Built as a static bundle,
# served by nginx — there's no server-side runtime for this app. Built with
# the monorepo root as context, same reasoning as apps/api/Dockerfile.

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/permissions/package.json packages/permissions/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
# Build-time config: which API/Zitadel this bundle points at. Vite inlines
# these into the JS at build time — unlike apps/api's runtime env vars, a
# rebuild is required to change them. See docker-compose.images.yml for how
# these get threaded through from .env in a from-env deploy.
ARG VITE_ZITADEL_ISSUER
ARG VITE_ZITADEL_CLIENT_ID
ARG VITE_API_BASE_URL
ENV VITE_ZITADEL_ISSUER=${VITE_ZITADEL_ISSUER} \
    VITE_ZITADEL_CLIENT_ID=${VITE_ZITADEL_CLIENT_ID} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm --filter @saas-erp/shared-types build \
 && pnpm --filter @saas-erp/web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
