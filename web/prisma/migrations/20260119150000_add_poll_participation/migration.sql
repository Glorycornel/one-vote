-- CreateTable
CREATE TABLE "PollParticipation" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PollParticipation_userId_pollId_key" ON "PollParticipation"("userId", "pollId");

-- CreateIndex
CREATE INDEX "PollParticipation_pollId_idx" ON "PollParticipation"("pollId");

-- AddForeignKey
ALTER TABLE "PollParticipation" ADD CONSTRAINT "PollParticipation_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollParticipation" ADD CONSTRAINT "PollParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
