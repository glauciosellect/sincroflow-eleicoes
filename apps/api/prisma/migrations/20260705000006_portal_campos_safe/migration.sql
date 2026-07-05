-- Safe re-apply: adiciona colunas do portal que podem não existir no banco de produção
-- (migrations 000004 e 000005 foram marcadas como applied sem executar o SQL)
ALTER TABLE "PortalEleitor"
  ADD COLUMN IF NOT EXISTS "corDestaque" TEXT NOT NULL DEFAULT '#C9A227',
  ADD COLUMN IF NOT EXISTS "numero"      TEXT,
  ADD COLUMN IF NOT EXISTS "instagram"   TEXT,
  ADD COLUMN IF NOT EXISTS "facebook"    TEXT,
  ADD COLUMN IF NOT EXISTS "tiktok"      TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp"    TEXT,
  ADD COLUMN IF NOT EXISTS "trajetoria"  JSONB,
  ADD COLUMN IF NOT EXISTS "depoimentos" JSONB,
  ADD COLUMN IF NOT EXISTS "fotoSobre"   TEXT;
