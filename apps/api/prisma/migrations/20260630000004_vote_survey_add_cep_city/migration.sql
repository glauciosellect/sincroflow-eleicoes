-- AlterTable: adiciona CEP e cidade na pesquisa de intenção de voto
ALTER TABLE "VoteSurveyResponse"
  ADD COLUMN "cep"  TEXT,
  ADD COLUMN "city" TEXT;
