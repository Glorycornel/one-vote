-- AlterTable
ALTER TABLE "Poll"
  ADD COLUMN "allowAnonymousVotes" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "collectVoterEmail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vote"
  ADD COLUMN "voterEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vote_pollId_voterEmail_key" ON "Vote"("pollId", "voterEmail");
