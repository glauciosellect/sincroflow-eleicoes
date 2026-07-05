-- Cria tabela PendingRegistration se não existir
-- Necessária para o fluxo de cadastro em 2 passos (dados → pagamento → ativação)
CREATE TABLE IF NOT EXISTS "PendingRegistration" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "cpf"             TEXT NOT NULL,
    "candidateNumber" TEXT,
    "email"           TEXT NOT NULL,
    "whatsapp"        TEXT NOT NULL,
    "passwordHash"    TEXT NOT NULL,
    "paymentMethod"   TEXT NOT NULL,
    "plan"            TEXT NOT NULL DEFAULT 'CAMPAIGN',
    "status"          TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"      TIMESTAMP(3),
    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PendingRegistration_status_idx" ON "PendingRegistration"("status");

-- Também garante que Invoice tem as colunas adicionadas pela migration 000007
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "provider"     TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS "description"  TEXT,
  ADD COLUMN IF NOT EXISTS "installments" INTEGER NOT NULL DEFAULT 1;

-- Garante que Candidate tem as colunas do Asaas
ALTER TABLE "Candidate"
  ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "asaasPaymentId"  TEXT,
  ADD COLUMN IF NOT EXISTS "asaasPlano"      TEXT;
