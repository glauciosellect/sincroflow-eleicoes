-- CreateTable
CREATE TABLE "Audiencia" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "assunto" TEXT NOT NULL,
    "descricao" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "encaminhamento" TEXT,
    "resultado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audiencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjetoLei" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "numero" TEXT,
    "titulo" TEXT NOT NULL,
    "ementa" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "dataProtocolo" TIMESTAMP(3),
    "dataVotacao" TIMESTAMP(3),
    "resultado" TEXT,
    "linkOficial" TEXT,
    "temas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjetoLei_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocoloAtendimento" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "telefone" TEXT,
    "assunto" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "responsavel" TEXT,
    "resposta" TEXT,
    "resolvidoEm" TIMESTAMP(3),
    "prazo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocoloAtendimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Audiencia_candidateId_status_idx" ON "Audiencia"("candidateId", "status");
CREATE INDEX "Audiencia_candidateId_dataHora_idx" ON "Audiencia"("candidateId", "dataHora");

-- CreateIndex
CREATE INDEX "ProjetoLei_candidateId_status_idx" ON "ProjetoLei"("candidateId", "status");
CREATE INDEX "ProjetoLei_candidateId_tipo_idx" ON "ProjetoLei"("candidateId", "tipo");

-- CreateIndex
CREATE INDEX "ProtocoloAtendimento_candidateId_status_idx" ON "ProtocoloAtendimento"("candidateId", "status");
CREATE INDEX "ProtocoloAtendimento_candidateId_createdAt_idx" ON "ProtocoloAtendimento"("candidateId", "createdAt");

-- AddForeignKey
ALTER TABLE "Audiencia" ADD CONSTRAINT "Audiencia_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetoLei" ADD CONSTRAINT "ProjetoLei_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocoloAtendimento" ADD CONSTRAINT "ProtocoloAtendimento_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
