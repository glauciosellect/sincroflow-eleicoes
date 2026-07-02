CREATE TABLE "ColaboradorCampanha" (
  "id"             TEXT NOT NULL,
  "candidateId"    TEXT NOT NULL,
  "nome"           TEXT NOT NULL,
  "cpf"            TEXT NOT NULL,
  "funcao"         TEXT NOT NULL,
  "funcaoCustom"   TEXT,
  "telefone"       TEXT,
  "email"          TEXT,
  "dataInicio"     TIMESTAMP(3) NOT NULL,
  "dataFim"        TIMESTAMP(3),
  "valorAcordado"  DECIMAL(12,2) NOT NULL,
  "periodicidade"  TEXT NOT NULL DEFAULT 'mensal',
  "formaPagamento" TEXT NOT NULL DEFAULT 'pix',
  "observacao"     TEXT,
  "status"         TEXT NOT NULL DEFAULT 'ativo',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ColaboradorCampanha_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PagamentoColaborador" (
  "id"             TEXT NOT NULL,
  "candidateId"    TEXT NOT NULL,
  "colaboradorId"  TEXT NOT NULL,
  "valor"          DECIMAL(12,2) NOT NULL,
  "dataPagamento"  TIMESTAMP(3) NOT NULL,
  "competencia"    TEXT,
  "formaPagamento" TEXT NOT NULL DEFAULT 'pix',
  "comprovante"    TEXT,
  "observacao"     TEXT,
  "lancamentoId"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PagamentoColaborador_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ColaboradorCampanha_candidateId_status_idx" ON "ColaboradorCampanha"("candidateId", "status");
CREATE INDEX "ColaboradorCampanha_candidateId_funcao_idx" ON "ColaboradorCampanha"("candidateId", "funcao");
CREATE INDEX "PagamentoColaborador_candidateId_dataPagamento_idx" ON "PagamentoColaborador"("candidateId", "dataPagamento");
CREATE INDEX "PagamentoColaborador_colaboradorId_idx" ON "PagamentoColaborador"("colaboradorId");

ALTER TABLE "ColaboradorCampanha" ADD CONSTRAINT "ColaboradorCampanha_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PagamentoColaborador" ADD CONSTRAINT "PagamentoColaborador_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PagamentoColaborador" ADD CONSTRAINT "PagamentoColaborador_colaboradorId_fkey"
  FOREIGN KEY ("colaboradorId") REFERENCES "ColaboradorCampanha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
