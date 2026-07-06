import { prisma } from './prisma'

/**
 * Garante que um eleitor captado fora do WhatsApp (campo ou portal)
 * existe na tabela Contact e está vinculado ao canal virtual correto.
 *
 * channelType: 'CAMPO' (coordenador/agente de campo) | 'PORTAL' (portal do eleitor)
 * sourceName:  nome do coordenador, agente ou slug do portal — aparece como identificador do canal
 *
 * Retorna o contactId criado ou encontrado.
 */
export async function syncContactFromField(params: {
  candidateId: string
  channelType: 'CAMPO' | 'PORTAL'
  sourceName: string   // ex: "Ana Paula" ou "portal-waldomiro"
  nome: string
  telefone?: string | null
  email?: string | null
  bairro?: string | null
  cidade?: string | null
}): Promise<string> {
  const { candidateId, channelType, sourceName, nome, telefone, email, bairro, cidade } = params

  // Canal virtual por fonte — um por coordenador/portal por candidato
  // identificado pelo nome da fonte para não criar duplicatas
  let channel = await prisma.channel.findFirst({
    where: { candidateId, type: channelType as any, name: sourceName },
  })

  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        candidateId,
        type: channelType as any,
        name: sourceName,
        isActive: true,
        config: { sourceName, channelType },
      },
    })
  }

  // Contato identificado pelo telefone (se tiver) ou pelo nome+canal
  const phoneClean = telefone?.replace(/\D/g, '') || null
  const contactExternalId = phoneClean
    ? `tel-${phoneClean}`
    : `nome-${nome.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

  const existing = phoneClean
    ? await prisma.contact.findFirst({
        where: { candidateId, phone: phoneClean },
      })
    : null

  if (existing) {
    // Atualiza dados se veio com mais informação
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: existing.name || nome,
        email: existing.email || email || undefined,
        neighborhood: existing.neighborhood || bairro || undefined,
        totalInteractions: { increment: 1 },
        lastContactAt: new Date(),
      },
    })
    return existing.id
  }

  // Cria novo contato
  const contact = await prisma.contact.create({
    data: {
      candidateId,
      channelId: channel.id,
      externalId: contactExternalId,
      name: nome,
      phone: phoneClean || undefined,
      email: email || undefined,
      neighborhood: bairro || cidade || undefined,
      contactType: 'VOTER',
      firstContactAt: new Date(),
      lastContactAt: new Date(),
      totalInteractions: 1,
    },
  })

  return contact.id
}
