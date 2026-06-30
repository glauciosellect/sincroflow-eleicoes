import { prisma } from './prisma'

// Janela de conversação WABA (seção 3.2 da spec): mensagem livre só é permitida até
// 24h após a última mensagem ENVIADA PELO ELEITOR. Fora da janela, a Meta rejeita
// mensagens livres — é obrigatório usar um template pré-aprovado para reabrir contato.
const WINDOW_MS = 24 * 60 * 60 * 1000

export async function isWhatsAppWindowOpen(contactId: string): Promise<boolean> {
  const lastVoterMessage = await prisma.message.findFirst({
    where: { conversation: { contactId }, senderType: 'VOTER' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!lastVoterMessage) return false
  return Date.now() - lastVoterMessage.createdAt.getTime() < WINDOW_MS
}

// Templates WABA aprovados pela Meta (seção 3.2 da spec) — nomes e idioma exatamente
// como cadastrados no Business Manager. sae_novidade é o único usado para reabrir
// contato com criativo (header IMAGE + footer com instrução de opt-out).
export const WABA_TEMPLATES = {
  reengagement: { name: 'sae_novidade', languageCode: 'pt_BR' },
} as const
