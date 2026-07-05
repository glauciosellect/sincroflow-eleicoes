-- Migration: add pixKey and elevenLabsVoiceId to AgentConfig
ALTER TABLE "AgentConfig" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;
ALTER TABLE "AgentConfig" ADD COLUMN IF NOT EXISTS "elevenLabsVoiceId" TEXT;
