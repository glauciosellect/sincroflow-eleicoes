-- CreateTable
CREATE TABLE "RadarMonitorado" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "rssUrl" TEXT,
    "twitterQuery" TEXT,
    "plataformas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaColeta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadarMonitorado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadarResultado" (
    "id" TEXT NOT NULL,
    "radarId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT,
    "texto" TEXT NOT NULL,
    "url" TEXT,
    "autor" TEXT,
    "engajamento" INTEGER,
    "sentimento" TEXT,
    "relevancia" INTEGER NOT NULL DEFAULT 0,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "alertaGerado" BOOLEAN NOT NULL DEFAULT false,
    "coletadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadarResultado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumoRadar" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "resumoTexto" TEXT NOT NULL,
    "principaisAlertas" JSONB NOT NULL,
    "sugestaoAcao" TEXT,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumoRadar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RadarMonitorado_candidateId_ativo_idx" ON "RadarMonitorado"("candidateId", "ativo");

-- CreateIndex
CREATE INDEX "RadarResultado_radarId_lido_idx" ON "RadarResultado"("radarId", "lido");

-- CreateIndex
CREATE INDEX "RadarResultado_candidateId_relevancia_idx" ON "RadarResultado"("candidateId", "relevancia");

-- CreateIndex
CREATE INDEX "RadarResultado_coletadoEm_idx" ON "RadarResultado"("coletadoEm");

-- CreateIndex
CREATE INDEX "ResumoRadar_candidateId_tipo_idx" ON "ResumoRadar"("candidateId", "tipo");

-- AddForeignKey
ALTER TABLE "RadarMonitorado" ADD CONSTRAINT "RadarMonitorado_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadarResultado" ADD CONSTRAINT "RadarResultado_radarId_fkey" FOREIGN KEY ("radarId") REFERENCES "RadarMonitorado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadarResultado" ADD CONSTRAINT "RadarResultado_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoRadar" ADD CONSTRAINT "ResumoRadar_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
