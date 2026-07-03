-- Adiciona PORTAL ao enum ChannelType
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'PORTAL';

-- Adiciona contactId em CadastroPortal
ALTER TABLE "CadastroPortal"
  ADD COLUMN IF NOT EXISTS "contactId" TEXT;

ALTER TABLE "CadastroPortal"
  ADD CONSTRAINT "CadastroPortal_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
