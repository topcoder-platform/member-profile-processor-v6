-- CreateTable
CREATE TABLE "project_info" (
    "project_id" INTEGER NOT NULL,
    "project_info_type_id" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(64),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" VARCHAR(64),

    CONSTRAINT "project_info_pkey" PRIMARY KEY ("project_id","project_info_type_id")
);

-- CreateIndex
CREATE INDEX "project_info_value_idx" ON "project_info"("value");
