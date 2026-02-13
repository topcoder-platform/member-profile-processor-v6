-- CreateTable
CREATE TABLE "challenges" (
    "id" SERIAL NOT NULL,
    "legacyId" INTEGER NOT NULL,
    "componentId" INTEGER,
    "ratedInd" INTEGER,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "handle" TEXT NOT NULL,
    "rating" INTEGER DEFAULT 1200,
    "vol" INTEGER DEFAULT 300,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_challenges" (
    "userId" INTEGER NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "attended" TEXT,
    "placed" INTEGER,
    "old_rating" INTEGER,
    "old_vol" INTEGER,
    "system_point_total" DOUBLE PRECISION,
    "point_total" DOUBLE PRECISION,
    "rated_ind" INTEGER,

    CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("userId","challengeId")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "initialScore" DOUBLE PRECISION,
    "submissionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionNumber" INTEGER NOT NULL,
    "example" INTEGER NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "languageId" INTEGER NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_history" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "vol" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,

    CONSTRAINT "ReviewType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "challenges_legacyId_key" ON "challenges"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- AddForeignKey
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE; 