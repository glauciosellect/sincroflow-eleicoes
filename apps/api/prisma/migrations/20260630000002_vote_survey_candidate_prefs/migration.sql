-- AlterTable
ALTER TABLE "VoteSurveyResponse"
  ADD COLUMN "prefVereador"      TEXT,
  ADD COLUMN "prefDepEstadual"   TEXT,
  ADD COLUMN "prefDepFederal"    TEXT,
  ADD COLUMN "prefSenador"       TEXT,
  ADD COLUMN "prefGovernador"    TEXT,
  ADD COLUMN "prefPresidente"    TEXT;
