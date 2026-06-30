-- CreateTable
CREATE TABLE "FactCheck" (
  "id"             TEXT NOT NULL,
  "candidateId"    TEXT NOT NULL,
  "checkedById"    TEXT,
  "query"          TEXT NOT NULL,
  "verdict"        TEXT NOT NULL,
  "analysis"       TEXT NOT NULL,
  "suggestedReply" TEXT NOT NULL,
  "sources"        TEXT[] NOT NULL DEFAULT '{}',
  "savedToLibrary" BOOLEAN NOT NULL DEFAULT false,
  "tags"           TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FactCheck_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FactCheck" ADD CONSTRAINT "FactCheck_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactCheck" ADD CONSTRAINT "FactCheck_checkedById_fkey"
  FOREIGN KEY ("checkedById") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "FactCheck_candidateId_createdAt_idx" ON "FactCheck"("candidateId", "createdAt");
CREATE INDEX "FactCheck_candidateId_verdict_idx" ON "FactCheck"("candidateId", "verdict");
