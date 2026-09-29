-- schema.prisma's User model has had `phone` and `avatarUrl` for a while,
-- but neither ever got a real migration - direct schema edits without
-- `prisma migrate dev`, so `_prisma_migrations` never recorded the drift.
-- Every query touching `users` (profile lookups, tenant user listings,
-- auth) was failing in production with "column users.phone does not
-- exist" until this closed the gap.
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
