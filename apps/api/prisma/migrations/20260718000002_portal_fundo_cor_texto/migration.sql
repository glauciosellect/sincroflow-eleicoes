-- Portal do Eleitor: foto de fundo do hero (substitui o gradiente de cor) e cor de
-- texto separada da cor de fundo (hoje o texto do hero era branco fixo).
ALTER TABLE "PortalEleitor"
  ADD COLUMN IF NOT EXISTS "fotoFundo" TEXT,
  ADD COLUMN IF NOT EXISTS "corTexto" TEXT NOT NULL DEFAULT '#FFFFFF';
