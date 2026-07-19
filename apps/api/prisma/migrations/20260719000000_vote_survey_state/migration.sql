-- Mapa de Apoiadores: adiciona UF (estado) à pesquisa de voto, coletado do ViaCEP,
-- para permitir agregação por estado além de bairro/cidade (candidatos de cargo estadual).
ALTER TABLE "VoteSurveyResponse"
  ADD COLUMN IF NOT EXISTS "state" TEXT;
