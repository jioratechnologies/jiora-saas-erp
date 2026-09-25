#!/bin/sh
# Shell, not plain .sql, because this needs the APP_RUNTIME_PASSWORD env var
# substituted in — the official postgres image only expands env vars in
# .sh init scripts, not .sql ones. Set APP_RUNTIME_PASSWORD in infra/.env
# for a real deployment; docker-compose.yml gives it a dev-only default.
#
# See docs/adr/0001-multi-tenancy-shared-schema-rls.md for why this role
# (not the migration-owner role "saaserp") is what the app connects as.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE app_runtime LOGIN PASSWORD '${APP_RUNTIME_PASSWORD}';
    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO app_runtime;
EOSQL
