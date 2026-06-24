import { prisma } from '../../lib/prisma'

// Formato do protocolo conforme seção 4.12 da spec: #EL-2026-00042
async function generateProtocolNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `EL-${year}-`

  // Conta quantas solicitações já existem neste ano para sequenciar — não é perfeitamente
  // atômico sob alta concorrência, mas colisão é coberta pelo @unique + retry abaixo.
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.request.count({ where: { protocolNumber: { startsWith: prefix } } })
    const candidate = `${prefix}${String(count + 1 + attempt).padStart(5, '0')}`
    const exists = await prisma.request.findUnique({ where: { protocolNumber: candidate } })
    if (!exists) return candidate
  }
  // Fallback extremamente improvável de ser alcançado
  return `${prefix}${Date.now()}`
}

export async function createRequest(opts: {
  candidateId: string
  contactId: string
  conversationId?: string
  subject: string
  description?: string
  region?: string
  neighborhood?: string
}) {
  const protocolNumber = await generateProtocolNumber()
  return prisma.request.create({
    data: {
      candidateId: opts.candidateId,
      contactId: opts.contactId,
      conversationId: opts.conversationId,
      protocolNumber,
      subject: opts.subject,
      description: opts.description,
      region: opts.region,
      neighborhood: opts.neighborhood,
    },
  })
}

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'recebida',
  ANALYZING: 'em análise pela equipe',
  FORWARDED: 'encaminhada',
  RESOLVED: 'resolvida',
}

export async function getRequestStatusMessage(candidateId: string, protocolNumber: string): Promise<string | null> {
  const request = await prisma.request.findFirst({ where: { candidateId, protocolNumber } })
  if (!request) return null
  const label = STATUS_LABELS[request.status] || request.status
  return `Sobre o protocolo ${request.protocolNumber}, sua solicitação está ${label}.`
}
