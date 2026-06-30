import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { auditLog, requireModule } from '../../lib/rbac'
import { broadcastQueue } from '../../lib/queue'
import { getEligibleWhatsAppChannels, splitTargetsRoundRobin } from '../../lib/whatsapp-round-robin'

const MAX_BROADCAST_TARGETS = 500
// WhatsApp: limite por LINHA (cada número tem seu próprio teto, candidato pode ter
// várias linhas). E-mail: canal único por candidato, sem conceito de "linha" — teto
// fixo e conservador baseado no limite real do Gmail gratuito (500/dia), com margem
// para outras respostas automáticas do dia também contarem. Telegram não tem teto de
// 24h nem restrição de conteúdo político (seção 7.1 da spec) — é o canal principal
// de re-engajamento, sem as limitações do WhatsApp.
const MAX_24H_PER_LINE = 250
const MAX_24H_EMAIL = 400
const SEND_INTERVAL_MS = 3000
const TELEGRAM_SEND_INTERVAL_MS = 35 // ~30 msg/s, limite da Telegram Bot API

type BroadcastChannelType = 'WHATSAPP' | 'EMAIL' | 'TELEGRAM'

function max24hLimitFor(channelType: BroadcastChannelType): number {
  if (channelType === 'EMAIL') return MAX_24H_EMAIL
  if (channelType === 'TELEGRAM') return Infinity
  return MAX_24H_PER_LINE
}

function noChannelErrorFor(channelType: BroadcastChannelType): string {
  if (channelType === 'EMAIL') return 'Nenhum e-mail ativo conectado'
  if (channelType === 'TELEGRAM') return 'Nenhum bot do Telegram conectado'
  return 'Nenhum WhatsApp ativo conectado (ou todos degradados)'
}

async function resolveTargets(candidateId: string, channelType: BroadcastChannelType, contactType?: string) {
  return prisma.contact.findMany({
    where: {
      candidateId,
      optedOutAt: null,
      ...(contactType ? { contactType: contactType as any } : {}),
      channel: { type: channelType },
    },
    select: { id: true, externalId: true },
  })
}

async function getActiveChannel(candidateId: string, channelType: BroadcastChannelType) {
  return prisma.channel.findFirst({ where: { candidateId, type: channelType, isActive: true } })
}

// Canais elegíveis para distribuir um disparo: WhatsApp pode ter várias linhas
// (round-robin, excluindo YELLOW/RED); e-mail e Telegram têm sempre no máximo 1
// canal por candidato, então a lista cai naturalmente para 0 ou 1 elemento.
async function getEligibleChannelsForBroadcast(candidateId: string, channelType: BroadcastChannelType) {
  if (channelType === 'WHATSAPP') return getEligibleWhatsAppChannels(candidateId)
  const channel = await getActiveChannel(candidateId, channelType)
  return channel ? [channel] : []
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
    const channelType: BroadcastChannelType = rawChannelType === 'EMAIL' ? 'EMAIL' : rawChannelType === 'TELEGRAM' ? 'TELEGRAM' : 'WHATSAPP'

    const creative = await prisma.creative.findFirst({ where: { id: creativeId, candidateId } })
    if (!creative) return reply.status(404).send({ error: 'Criativo não encontrado' })

    const eligibleChannels = await getEligibleChannelsForBroadcast(candidateId, channelType)
    if (eligibleChannels.length === 0) return reply.status(400).send({ error: noChannelErrorFor(channelType) })

    const targets = await resolveTargets(candidateId, channelType, contactType)
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    const activeMsgsRemaining = (candidate!.activeMsgsIncluded + candidate!.activeMsgsExtra) - candidate!.activeMsgsUsed

    const alreadyReceivedCount = await prisma.broadcastRecipient.count({
      where: { contactId: { in: targets.map((t) => t.id) }, broadcast: { creativeId } },
    })

    // Capacidade 24h é por LINHA — soma a capacidade restante de todos os
    // canais elegíveis, já que o disparo será distribuído (round-robin) entre eles.
    // Telegram não tem teto (seção 7.1 da spec) — max24h é Infinity, sem necessidade
    // de contar envios anteriores.
    const max24h = max24hLimitFor(channelType)
    let sentLast24h = 0
    let remaining24hCapacity = Number.isFinite(max24h) ? 0 : null
    if (Number.isFinite(max24h)) {
      for (const channel of eligibleChannels) {
        const sent = await prisma.broadcastRecipient.count({
          where: { broadcast: { channelId: channel.id }, sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        })
        sentLast24h += sent
        remaining24hCapacity = (remaining24hCapacity ?? 0) + Math.max(0, max24h - sent)
      }
    }

    return reply.send({
      totalTargets: targets.length,
      maxTargets: MAX_BROADCAST_TARGETS,
      activeMsgsRemaining,
      alreadyReceivedCount,
      sentLast24h,
      max24hPerLine: Number.isFinite(max24h) ? max24h : null,
      remaining24hCapacity,
      linesUsed: eligibleChannels.length,
    })
  })

  app.post('/broadcasts', { onRequest: [requireModule('story')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { creativeId, contactType, channelType } = z.object({
      creativeId: z.string(),
      contactType: z.enum(['VOTER', 'FAMILY_FRIEND', 'STAFF', 'CONTRACTOR', 'OTHER']).optional(),
      channelType: z.enum(['WHATSAPP', 'EMAIL', 'TELEGRAM']).default('WHATSAPP'),
    }).parse(req.body)

    const agentConfig = await prisma.agentConfig.findUnique({ where: { candidateId } })
    if (!agentConfig?.isActive) return reply.status(400).send({ error: 'Assistente desativado — não é possível disparar criativos.' })

    const creative = await prisma.creative.findFirst({ where: { id: creativeId, candidateId } })
    if (!creative) return reply.status(404).send({ error: 'Criativo não encontrado' })

    const eligibleChannels = await getEligibleChannelsForBroadcast(candidateId, channelType)
    if (eligibleChannels.length === 0) return reply.status(400).send({ error: noChannelErrorFor(channelType) })

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

    // Distribui os alvos entre as linhas elegíveis (round-robin) — cada linha
    // vira um Broadcast separado, já que o schema liga 1 Broadcast a 1 Channel.
    const max24h = max24hLimitFor(channelType)
    const buckets = splitTargetsRoundRobin(targets, eligibleChannels)

    if (Number.isFinite(max24h)) {
      for (const bucket of buckets) {
        const sentLast24h = await prisma.broadcastRecipient.count({
          where: { broadcast: { channelId: bucket.channel.id }, sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        })
        if (sentLast24h + bucket.targets.length > max24h) {
          return reply.status(400).send({
            error: channelType === 'EMAIL'
              ? `Limite de envios por e-mail nas últimas 24h seria excedido (${sentLast24h} já enviados, limite ${max24h}). Aguarde para disparar novamente.`
              : `Limite de envios nas últimas 24h seria excedido em uma das linhas de WhatsApp (${sentLast24h} já enviados, limite ${max24h} por linha). Aguarde ou reduza o público.`,
          })
        }
      }
    }

    const sendIntervalMs = channelType === 'TELEGRAM' ? TELEGRAM_SEND_INTERVAL_MS : SEND_INTERVAL_MS

    const broadcasts = await Promise.all(
      buckets.map((bucket) =>
        prisma.broadcast.create({
          data: {
            candidateId,
            creativeId,
            channelId: bucket.channel.id,
            contactType: contactType as any,
            totalTargets: bucket.targets.length,
            createdById: sub,
          },
        }),
      ),
    )

    await Promise.all(
      buckets.flatMap((bucket, bucketIndex) =>
        bucket.targets.map((target, index) =>
          broadcastQueue.add(
            'send',
            { broadcastId: broadcasts[bucketIndex].id, contactId: target.id },
            { delay: index * sendIntervalMs, attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
          ),
        ),
      ),
    )

    await auditLog({
      candidateId,
      eventType: 'broadcast_created',
      metadata: { broadcastIds: broadcasts.map((b) => b.id), creativeId, totalTargets: targets.length, linesUsed: buckets.length, contactType, channelType },
    })

    return reply.status(201).send({ broadcasts, totalTargets: targets.length, linesUsed: buckets.length })
  })
}
