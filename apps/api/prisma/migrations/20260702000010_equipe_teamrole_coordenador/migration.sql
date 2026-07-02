-- Adiciona role COORDENADOR no enum TeamRole
ALTER TYPE "TeamRole" ADD VALUE IF NOT EXISTS 'COORDENADOR';

-- Adiciona vínculo teamMemberId em ColaboradorCampanha
ALTER TABLE "ColaboradorCampanha"
  ADD COLUMN IF NOT EXISTS "teamMemberId" TEXT UNIQUE;

ALTER TABLE "ColaboradorCampanha"
  ADD CONSTRAINT "ColaboradorCampanha_teamMemberId_fkey"
  FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
