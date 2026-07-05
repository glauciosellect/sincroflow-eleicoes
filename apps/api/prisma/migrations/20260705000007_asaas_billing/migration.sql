-- Adiciona campos Asaas no Candidate
ALTER TABLE "Candidate"
  ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "asaasPaymentId"  TEXT,
  ADD COLUMN IF NOT EXISTS "asaasPlano"      TEXT;

-- Adiciona campos extras no Invoice
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "provider"     TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS "description"  TEXT,
  ADD COLUMN IF NOT EXISTS "installments" INTEGER NOT NULL DEFAULT 1;
