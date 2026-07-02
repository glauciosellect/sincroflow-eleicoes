-- CreateTable
CREATE TABLE "LancamentoFinanceiro" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "fornecedor" TEXT,
    "notaFiscal" TEXT,
    "comprovante" TEXT,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmado',
    "tseCategoria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoFinanceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaOrcamento" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "totalPrevisto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "alertaPercentual" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaOrcamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LancamentoFinanceiro_candidateId_tipo_idx" ON "LancamentoFinanceiro"("candidateId", "tipo");

-- CreateIndex
CREATE INDEX "LancamentoFinanceiro_candidateId_data_idx" ON "LancamentoFinanceiro"("candidateId", "data");

-- CreateIndex
CREATE INDEX "LancamentoFinanceiro_candidateId_categoria_idx" ON "LancamentoFinanceiro"("candidateId", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "MetaOrcamento_candidateId_key" ON "MetaOrcamento"("candidateId");

-- AddForeignKey
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaOrcamento" ADD CONSTRAINT "MetaOrcamento_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
