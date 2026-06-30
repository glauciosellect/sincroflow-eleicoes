-- CreateEnum
CREATE TYPE "VoteIntention" AS ENUM ('APOIADOR', 'INDECISO', 'CRITICO');

-- CreateTable
CREATE TABLE "VoteSurveyResponse" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "collectedById" TEXT,
    "voterName" TEXT,
    "voterPhone" TEXT,
    "neighborhood" TEXT,
    "intention" "VoteIntention" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteSurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoteSurveyResponse_candidateId_createdAt_idx" ON "VoteSurveyResponse"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "VoteSurveyResponse_candidateId_intention_idx" ON "VoteSurveyResponse"("candidateId", "intention");

-- CreateIndex
CREATE INDEX "VoteSurveyResponse_candidateId_collectedById_idx" ON "VoteSurveyResponse"("candidateId", "collectedById");

-- AddForeignKey
ALTER TABLE "VoteSurveyResponse" ADD CONSTRAINT "VoteSurveyResponse_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteSurveyResponse" ADD CONSTRAINT "VoteSurveyResponse_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
