-- Vínculo entre Coordenador (login de campo) e ColaboradorCampanha (registro financeiro/hierarquia)
-- Permite que o coordenador veja apenas os subordinados da sua equipe via supervisorId
ALTER TABLE "Coordenador"
  ADD COLUMN IF NOT EXISTS "colaboradorId" TEXT;

CREATE INDEX IF NOT EXISTS "Coordenador_colaboradorId_idx" ON "Coordenador"("colaboradorId");
