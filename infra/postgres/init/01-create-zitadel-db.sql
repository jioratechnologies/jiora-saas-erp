-- Zitadel manages its own schema/migrations, but needs its database to
-- exist up front. The app database (saaserp) is created automatically by
-- the postgres image via POSTGRES_DB.
CREATE DATABASE zitadel;
