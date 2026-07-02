-- CreateTable
CREATE TABLE "PortalEleitor" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT,
    "descricao" TEXT,
    "fotoUrl" TEXT,
    "corPrimaria" TEXT NOT NULL DEFAULT '#002776',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "totalCadastros" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalEleitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CadastroPortal" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "cidade" TEXT,
    "bairro" TEXT,
    "assunto" TEXT,
    "mensagem" TEXT,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "origemIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CadastroPortal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalEleitor_candidateId_key" ON "PortalEleitor"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalEleitor_slug_key" ON "PortalEleitor"("slug");

-- CreateIndex
CREATE INDEX "PortalEleitor_slug_idx" ON "PortalEleitor"("slug");

-- CreateIndex
CREATE INDEX "CadastroPortal_portalId_status_idx" ON "CadastroPortal"("portalId", "status");

-- CreateIndex
CREATE INDEX "CadastroPortal_portalId_createdAt_idx" ON "CadastroPortal"("portalId", "createdAt");

-- AddForeignKey
ALTER TABLE "PortalEleitor" ADD CONSTRAINT "PortalEleitor_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CadastroPortal" ADD CONSTRAINT "CadastroPortal_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "PortalEleitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
