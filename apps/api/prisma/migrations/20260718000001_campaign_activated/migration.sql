-- Módulo 8 (SPEC-SyncroFlowEleicoes-Escala-Webhooks): separa "conta existe/ativa"
-- de "campanha paga/ativada" — status Candidate.status continua ACTIVE desde o
-- cadastro (para o atendimento por IA funcionar imediatamente).
ALTER TABLE "Candidate"
  ADD COLUMN IF NOT EXISTS "campaignActivated" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: candidatos existentes que já pagaram (campaignPaidUntil no futuro) ou têm
-- assinatura Stripe ativa já contam como campanha ativada, para não bloquear ninguém
-- que já usa o sistema normalmente hoje.
UPDATE "Candidate"
SET "campaignActivated" = true
WHERE "campaignPaidUntil" IS NOT NULL AND "campaignPaidUntil" > NOW();

UPDATE "Candidate"
SET "campaignActivated" = true
WHERE "stripeSubscriptionId" IS NOT NULL AND "status" = 'ACTIVE';
