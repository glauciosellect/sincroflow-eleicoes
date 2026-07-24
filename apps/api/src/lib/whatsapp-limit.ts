import { prisma } from './prisma'

// Convenção: -1 em Candidate.whatsappLineLimit significa "ilimitado" (plano Enterprise)
export const UNLIMITED = -1

export class WhatsAppLimitExceededError extends Error {
  constructor(public limit: number, public current: number) {
    super(`Limite de números de WhatsApp do plano atingido (${current}/${limit})`)
  }
}

// Números Salvy cancelados ficam no banco como histórico (isActive:false,
// config.salvyStatus:'canceled') mas não devem ocupar vaga do limite do plano — mesma
// regra já aplicada na UI (ver settings/page.tsx, isCanceledSalvyChannel).
function countActiveWhatsAppChannels(candidateId: string) {
  return prisma.channel.count({
    where: {
      candidateId,
      type: 'WHATSAPP',
      NOT: { config: { path: ['salvyStatus'], equals: 'canceled' } },
    },
  })
}

/**
 * Lança WhatsAppLimitExceededError se o candidato já estiver no limite do plano.
 * O limite é único e compartilhado entre número próprio e Salvy — o candidato escolhe
 * livremente a distribuição entre os dois tipos dentro do total contratado (planos
 * mais caros / linhas extras compradas aumentam esse total). Deve ser chamado ANTES
 * de criar um novo Channel do tipo WHATSAPP.
 */
export async function assertWhatsAppLimit(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { whatsappLineLimit: true },
  })
  if (!candidate) throw new Error('Candidato não encontrado')
  if (candidate.whatsappLineLimit === UNLIMITED) return

  const current = await countActiveWhatsAppChannels(candidateId)
  if (current >= candidate.whatsappLineLimit) {
    throw new WhatsAppLimitExceededError(candidate.whatsappLineLimit, current)
  }
}

/** Usado pela UI para exibir "X de Y números conectados". */
export async function getWhatsAppUsage(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { whatsappLineLimit: true },
  })
  if (!candidate) throw new Error('Candidato não encontrado')
  const current = await countActiveWhatsAppChannels(candidateId)
  return { current, limit: candidate.whatsappLineLimit, unlimited: candidate.whatsappLineLimit === UNLIMITED }
}
