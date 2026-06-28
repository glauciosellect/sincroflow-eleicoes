import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { auditLog, requireModule } from '../../lib/rbac'
import { broadcastQueue } from '../../lib/queue'

const MAX_BROADCAST_TARGETS = 500
// WhatsApp: limite por LINHA (cada número tem seu próprio teto, candidato pode ter
// várias linhas). E-mail: canal único por candidato, sem conceito de "linha" — teto
// fixo e conservador baseado no limite real do Gmail gratuito (500/dia), com margem
// para outras respostas automáticas do dia também contarem.
const MAX_24H_PER_LINE = 250
const MAX_24H_EMAIL = 400
const SEND_INTERVAL_MS = 3000

type BroadcastChannelType = 'WHATSAPP' | 'EMAIL'

function max24hLimitFor(channelType: BroadcastChannelType): number {
  return channelType === 'EMAIL' ? MAX_24H_EMAIL : MAX_24H_PER_LINE
}

async function resolveTargets(candidateId: string, channelType: BroadcastChannelType, contactType?: string) {
  return prisma.contact.findMany({
    where: { candidateId, ...(contactType ? { contactType: contactType as any } : {}), channel: { type: channelType } },
    select: { id: true, externalId: true },
  })
}

async function getActiveChannel(candidateId: string, channelType: BroadcastChannelType) {
  return prisma.channel.findFirst({ where: { candidateId, type: channelType, isActive: true } })
}

export async function broadcastRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/broadcasts', { onRequest: [requireModule('story')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const broadcasts = await prisma.broadcast.findMany({
      where: { candidateId },
      include: { creative: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send(broadcasts)
  })

  app.get('/broadcasts/preview', { onRequest: [requireModule('story')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { creativeId, contactType, channelType: rawChannelType } = req.query as { creativeId: string; contactType?: string; channelType?: string }
    const channelType: BroadcastChannelType = rawChannelType === 'EMAIL' ? 'EMAIL' : 'WHATSAPP'

    const creative = await prisma.creative.findFirst({ where: { id: creativeId, candidateId } })
    if (!creative) return reply.status(404).send({ error: 'Criativo não encontrado' })

    const channel = await getActiveChannel(candidateId, channelType)
    if (!channel) return reply.status(400).send({ error: channelType === 'EMAIL' ? 'Nenhum e-mail ativo conectado' : 'Nenhum WhatsApp ativo conectado' })

    const targets = await resolveTargets(candidateId, channelType, contactType)
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    const activeMsgsRemaining = (candidate!.activeMsgsIncluded + candidate!.activeMsgsExtra) - candidate!.activeMsgsUsed

    const alreadyReceivedCount = await prisma.broadcastRecipient.count({
      where: { contactId: { in: targets.map((t) => t.id) }, broadcast: { creativeId } },
    })

    const max24h = max24hLimitFor(channelType)
    const sentLast24h = await prisma.broadcastRecipient.count({
      where: { broadcast: { channelId: channel.id }, sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    })

    return reply.send({
      totalTargets: targets.length,
      maxTargets: MAX_BROADCAST_TARGETS,
      activeMsgsRemaining,
      alreadyReceivedCount,
      sentLast24h,
      max24hPerLine: max24h,
      remaining24hCapacity: Math.max(0, max24h - sentLast24h),
    })
  })

  app.post('/broadcasts', { onRequest: [requireModule('story')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { creativeId, contactType, channelType } = z.object({
      creativeId: z.string(),
      contactType: z.enum(['VOTER', 'FAMILY_FRIEND', 'STAFF', 'CONTRACTOR', 'OTHER']).optional(),
      channelType: z.enum(['WHATSAPP', 'EMAIL']).default('WHATSAPP'),
    }).parse(req.body)

    const agentConfig = await prisma.agentConfig.findUnique({ where: { candidateId } })
    if (!agentConfig?.isActive) return reply.status(400).send({ error: 'Assistente desativado — não é possível disparar criativos.' })

    const creative = await prisma.creative.findFirst({ where: { id: creativeId, candidateId } })
    if (!creative) return reply.status(404).send({ error: 'Criativo não encontrado' })

    const channel = await getActiveChannel(candidateId, channelType)
    if (!channel) return reply.status(400).send({ error: channelType === 'EMAIL' ? 'Nenhum e-mail ativo conectado' : 'Nenhum WhatsApp ativo conectado' })

    const targets = await resolveTargets(candidateId, channelType, contactType)
    if (targets.length === 0) return reply.status(400).send({ error: 'Nenhum contato elegível encontrado para esse filtro' })

    if (targets.length > MAX_BROADCAST_TARGETS) {
      return reply.status(400).send({ error: `Limite de ${MAX_BROADCAST_TARGETS} contatos por disparo excedido (${targets.length} selecionados). Refine o filtro.` })
    }

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    const activeMsgsRemaining = (candidate!.activeMsgsIncluded + candidate!.activeMsgsExtra) - candidate!.activeMsgsUsed
    if (activeMsgsRemaining < targets.length) {
      return reply.status(400).send({ error: `Mensagens ativas insuficientes: restam ${activeMsgsRemaining}, este disparo precisa de ${targets.length}. Compre uma recarga.` })
    }

    const max24h = max24hLimitFor(channelType)
    const sentLast24h = await prisma.broadcastRecipient.count({
      where: { broadcast: { channelId: channel.id }, sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    })
    if (sentLast24h + targets.length > max24h) {
      return reply.status(400).send({
        error: channelType === 'EMAIL'
          ? `Limite de envios por e-mail nas últimas 24h seria excedido (${sentLast24h} já enviados, limite ${max24h}). Aguarde para disparar novamente.`
          : `Limite de envios nas últimas 24h para esse número de WhatsApp seria excedido (${sentLast24h} já enviados, limite ${max24h}). Aguarde ou use outra linha.`,
      })
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        candidateId,
        creativeId,
        channelId: channel.id,
        contactType: contactType as any,
        totalTargets: targets.length,
        createdById: sub,
      },
    })

    await Promise.all(
      targets.map((target, index) =>
        broadcastQueue.add(
          'send',
          { broadcastId: broadcast.id, contactId: target.id },
          { delay: index * SEND_INTERVAL_MS, attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
        ),
      ),
    )

    await auditLog({
      candidateId,
      eventType: 'broadcast_created',
      metadata: { broadcastId: broadcast.id, creativeId, totalTargets: targets.length, contactType, channelType },
    })

    return reply.status(201).send(broadcast)
  })
}
