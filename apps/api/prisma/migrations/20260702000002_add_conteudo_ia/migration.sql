-- CreateTable
CREATE TABLE "ConteudoIA" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "temaCustomizado" TEXT,
    "plataforma" TEXT NOT NULL,
    "tom" TEXT NOT NULL DEFAULT 'proximo',
    "textoGerado" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "agendadoPara" TIMESTAMP(3),
    "enviadoEm" TIMESTAMP(3),
    "canalEnvio" TEXT,
    "tokensUsados" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConteudoIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConteudoIA_candidateId_status_idx" ON "ConteudoIA"("candidateId", "status");

-- CreateIndex
CREATE INDEX "ConteudoIA_candidateId_createdAt_idx" ON "ConteudoIA"("candidateId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConteudoIA" ADD CONSTRAINT "ConteudoIA_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
