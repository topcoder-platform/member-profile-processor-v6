-- Java parity: system_test_case.status is used in loadSystemTestCase filter.
ALTER TABLE "public"."system_test_case"
ADD COLUMN IF NOT EXISTS "status" INTEGER DEFAULT 1;

UPDATE "public"."system_test_case"
SET "status" = 1
WHERE "status" IS NULL;
