-- Person: add middle name + alternate phone; alt_phone replaces whatsapp.
ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "middle_name" TEXT;
ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "alt_phone" TEXT;
ALTER TABLE "persons" DROP COLUMN IF EXISTS "whatsapp";
