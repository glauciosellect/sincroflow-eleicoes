-- Adiciona tipo CAMPO ao enum ChannelType
-- Usado para identificar contatos captados por coordenadores e agentes de campo
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'CAMPO';
