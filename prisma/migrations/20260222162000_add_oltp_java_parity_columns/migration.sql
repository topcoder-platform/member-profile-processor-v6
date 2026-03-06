-- Add Java-parity OLTP columns required by loadRatingsToDW source queries.
ALTER TABLE "public"."round"
ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "public"."long_system_test_result"
ADD COLUMN IF NOT EXISTS "example" INTEGER DEFAULT 0;

ALTER TABLE "public"."long_system_test_result"
ADD COLUMN IF NOT EXISTS "fatal_errors" BYTEA;
