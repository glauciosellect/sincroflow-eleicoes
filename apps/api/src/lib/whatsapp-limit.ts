import { prisma } from './prisma'

// Convenção: -1 em Candidate.whatsappLineLimit significa "ilimitado" (plano Enterprise)
export const UNLIMITED = -1

export class WhatsAppLimitExceededError extends Error {
  constructor(public limit: number, public current: number) {
    super(`Limite de números de WhatsApp do plano atingido (${current}/${limit})`)
  }
}

/**
 * Lança WhatsAppLimitExceededError se o candidato já estiver no limite do plano.
 * Deve ser chamado ANTES de criar um novo Channel do tipo WHATSAPP.
 */
export async function assertWhatsAppLimit(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { whatsappLineLimit: true },
  })
  if (!candidate) throw new Error('Candidato não encontrado')
  if (candidate.whatsappLineLimit === UNLIMITED) return

  const current = await prisma.channel.count({ where: { candidateId, type: 'WHATSAPP' } })
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
  const current = await prisma.channel.count({ where: { candidateId, type: 'WHATSAPP' } })
  return { current, limit: candidate.whatsappLineLimit, unlimited: candidate.whatsappLineLimit === UNLIMITED }
}
