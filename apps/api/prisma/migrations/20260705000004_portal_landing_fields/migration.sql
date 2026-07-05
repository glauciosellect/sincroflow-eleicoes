-- AlterTable: adiciona campos para landing page completa do Portal do Eleitor
ALTER TABLE "PortalEleitor"
  ADD COLUMN "corDestaque" TEXT NOT NULL DEFAULT '#C9A227',
  ADD COLUMN "numero"      TEXT,
  ADD COLUMN "instagram"   TEXT,
  ADD COLUMN "facebook"    TEXT,
  ADD COLUMN "tiktok"      TEXT,
  ADD COLUMN "whatsapp"    TEXT,
  ADD COLUMN "trajetoria"  JSONB,
  ADD COLUMN "depoimentos" JSONB;
