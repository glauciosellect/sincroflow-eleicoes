import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { auditLog } from '../../lib/rbac'
import { broadcastQueue } from '../../lib/queue'

const MAX_BROADCAST_TARGETS = 500
const MAX_24H_PER_LINE = 250
const SEND_INTERVAL_MS = 3000

async function resolveTargets(candidateId: string, contactType?: string) {
  return prisma.contact.findMany({
    where: { candidateId, ...(contactType ? { contactType: contactType as any } : {}), channel: { type: 'WHATSAPP' } },
    select: { id: true, externalId: true },
  })
}

async function getActiveWhatsAppChannel(candidateId: string) {
  return prisma.channel.findFirst({ where: { candidateId, type: 'WHATSAPP', isActive: true } })
}

export async function broadcastRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/broadcasts', async (req, reply) => {
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

  app.get('/broadcasts/preview', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { creativeId, contactType } = req.query as { creativeId: string; contactType?: string }

    const creative = await prisma.creative.findFirst({ where: { id: creativeId, candidateId } })
    if (!creative) return reply.status(404).send({ error: 'Criativo não encontrado' })

    const channel = await getActiveWhatsAppChannel(candidateId)
    if (!channel) return reply.status(400).send({ error: 'Nenhum WhatsApp ativo conectado' })

    const targets = await resolveTargets(candidateId, contactType)
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    const activeMsgsRemaining = (candidate!.activeMsgsIncluded + candidate!.activeMsgsExtra) - candidate!.activeMsgsUsed

    const alreadyReceivedCount = await prisma.broadcastRecipient.count({
      where: { contactId: { in: targets.map((t) => t.id) }, broadcast: { creativeId } },
    })

    const sentLast24h = await prisma.broadcastRecipient.count({
      where: { broadcast: { channelId: channel.id }, sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    })

    return reply.send({
      totalTargets: targets.length,
      maxTargets: MAX_BROADCAST_TARGETS,
      activeMsgsRemaining,
      alreadyReceivedCount,
      sentLast24h,
      max24hPerLine: MAX_24H_PER_LINE,
      remaining24hCapacity: Math.max(0, MAX_24H_PER_LINE - sentLast24h),
    })
  })

  app.post('/broadcasts', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { creativeId, contactType } = z.object({
      creativeId: z.string(),
      contactType: z.enum(['VOTER', 'FAMILY_FRIEND', 'STAFF', 'CONTRACTOR', 'OTHER']).optional(),
    }).parse(req.body)

    const creative = await prisma.creative.findFirst({ where: { id: creativeId, candidateId } })
    if (!creative) return reply.status(404).send({ error: 'Criativo não encontrado' })

    const channel = await getActiveWhatsAppChannel(candidateId)
    if (!channel) return reply.status(400).send({ error: 'Nenhum WhatsApp ativo conectado' })

    const targets = await resolveTargets(candidateId, contactType)
    if (targets.length === 0) return reply.status(400).send({ error: 'Nenhum contato elegível encontrado para esse filtro' })

    if (targets.length > MAX_BROADCAST_TARGETS) {
      return reply.status(400).send({ error: `Limite de ${MAX_BROADCAST_TARGETS} contatos por disparo excedido (${targets.length} selecionados). Refine o filtro.` })
    }

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    const activeMsgsRemaining = (candidate!.activeMsgsIncluded + candidate!.activeMsgsExtra) - candidate!.activeMsgsUsed
    if (activeMsgsRemaining < targets.length) {
      return reply.status(400).send({ error: `Mensagens ativas insuficientes: restam ${activeMsgsRemaining}, este disparo precisa de ${targets.length}. Compre uma recarga.` })
    }

    const sentLast24h = await prisma.broadcastRecipient.count({
      where: { broadcast: { channelId: channel.id }, sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    })
    if (sentLast24h + targets.length > MAX_24H_PER_LINE) {
      return reply.status(400).send({
        error: `Limite de envios nas últimas 24h para esse número de WhatsApp seria excedido (${sentLast24h} já enviados, limite ${MAX_24H_PER_LINE}). Aguarde ou use outra linha.`,
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
      metadata: { broadcastId: broadcast.id, creativeId, totalTargets: targets.length, contactType },
    })

    return reply.status(201).send(broadcast)
  })
}
