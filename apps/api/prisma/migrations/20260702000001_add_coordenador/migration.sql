-- CreateTable
CREATE TABLE "Coordenador" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "cidade" TEXT,
    "bairros" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metaVotos" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcesso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coordenador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInLider" (
    "id" TEXT NOT NULL,
    "liderId" TEXT NOT NULL,
    "coordenadorId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "observacao" TEXT,
    "dataCheckin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInLider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coordenador_email_key" ON "Coordenador"("email");

-- CreateIndex
CREATE INDEX "Coordenador_candidateId_ativo_idx" ON "Coordenador"("candidateId", "ativo");

-- CreateIndex
CREATE INDEX "CheckInLider_coordenadorId_idx" ON "CheckInLider"("coordenadorId");

-- CreateIndex
CREATE INDEX "CheckInLider_candidateId_dataCheckin_idx" ON "CheckInLider"("candidateId", "dataCheckin");

-- AddForeignKey
ALTER TABLE "Coordenador" ADD CONSTRAINT "Coordenador_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInLider" ADD CONSTRAINT "CheckInLider_coordenadorId_fkey" FOREIGN KEY ("coordenadorId") REFERENCES "Coordenador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
