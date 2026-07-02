-- Adiciona campo supervisorId para hierarquia na equipe de campanha
ALTER TABLE "ColaboradorCampanha"
  ADD COLUMN IF NOT EXISTS "supervisorId" TEXT;

ALTER TABLE "ColaboradorCampanha"
  ADD CONSTRAINT "ColaboradorCampanha_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "ColaboradorCampanha"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ColaboradorCampanha_supervisorId_idx"
  ON "ColaboradorCampanha"("supervisorId");
