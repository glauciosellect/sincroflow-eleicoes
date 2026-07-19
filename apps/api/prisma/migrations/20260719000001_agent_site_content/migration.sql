-- Cache do conteúdo textual do site do candidato (scraping) para uso no prompt da IA,
-- evitando raspar o site a cada mensagem recebida do eleitor.
ALTER TABLE "AgentConfig"
  ADD COLUMN IF NOT EXISTS "siteContent" TEXT,
  ADD COLUMN IF NOT EXISTS "siteContentUpdatedAt" TIMESTAMP(3);
