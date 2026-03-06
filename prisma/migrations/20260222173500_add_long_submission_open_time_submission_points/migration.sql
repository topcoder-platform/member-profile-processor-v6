-- Java parity columns for loadProblemSubmission source query.
ALTER TABLE "public"."long_submission"
ADD COLUMN IF NOT EXISTS "open_time" TIMESTAMP(3);

ALTER TABLE "public"."long_submission"
ADD COLUMN IF NOT EXISTS "submission_points" DECIMAL(14,2);
