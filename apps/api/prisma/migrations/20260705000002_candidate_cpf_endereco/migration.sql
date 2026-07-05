-- Migration: add cpf (updatable) and address fields to Candidate
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "logradouro" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "numero" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "complemento" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "bairro" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "cep" TEXT;
