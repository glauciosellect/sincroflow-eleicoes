-- Módulo 2 (SPEC-SyncroFlowEleicoes-Escala-Webhooks): índice dedicado para resolver
-- canal em escala, evitando findMany + filtro em JS a cada mensagem recebida.
-- externalId = phoneNumberId (WhatsApp) | pageId (Facebook) | igAccountId (Instagram) | botId (Telegram)
ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- Backfill: popula externalId a partir do campo correspondente já salvo em config (JSON)
UPDATE "Channel"
SET "externalId" = "config"->>'phoneNumberId'
WHERE "type" = 'WHATSAPP'
  AND "externalId" IS NULL
  AND "config"->>'phoneNumberId' IS NOT NULL;

UPDATE "Channel"
SET "externalId" = "config"->>'pageId'
WHERE "type" = 'FACEBOOK'
  AND "externalId" IS NULL
  AND "config"->>'pageId' IS NOT NULL;

UPDATE "Channel"
SET "externalId" = "config"->>'igAccountId'
WHERE "type" = 'INSTAGRAM'
  AND "externalId" IS NULL
  AND "config"->>'igAccountId' IS NOT NULL;

-- Índice único (type, externalId) — múltiplos NULLs são permitidos pelo Postgres,
-- não bloqueia canais antigos (Telegram, ou WhatsApp ainda não conectado via Salvy/Embedded Signup).
CREATE UNIQUE INDEX IF NOT EXISTS "Channel_type_externalId_key" ON "Channel"("type", "externalId");
