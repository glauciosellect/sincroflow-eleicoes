import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { getComplianceStatus } from '../compliance/compliance.service'

// Relatórios implementados (ver docs/spec-eleicoes/04-modulos/4.9-relatorios.md):
// 1. Visão Geral da Semana, 4. Volume por Canal, 8. Eleitores Mais Engajados,
// 9. Evolução Semanal, 10. Status das Solicitações.
//
// TODO — ainda não implementados (exigem mais infra: NLP de temas, geolocalização,
// análise de sentimento, detecção de perguntas sem resposta):
// 2. Temas Mais Perguntados, 3. Mapa de Solicitações por Região, 5. Sentimento dos
// Eleitores, 6. Perguntas Sem Resposta (Gaps de Conteúdo), 7. Horários de Pico.

function dateRange(start?: string, end?: string) {
  const s = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const e = end ? new Date(end) : new Date()
  return { gte: s, lte: e }
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // Relatório 1: Visão Geral da Semana
  app.get('/analytics/overview', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    const range = dateRange(start, end)
    const previousRange = { gte: new Date(range.gte.getTime() - (range.lte.getTime() - range.gte.getTime())), lte: range.gte }

    const [conversations, newContacts, requests, resolvedRequests, prevConversations] = await prisma.$transaction([
      prisma.conversation.count({ where: { candidateId, createdAt: range } }),
      prisma.contact.count({ where: { candidateId, createdAt: range } }),
      prisma.request.count({ where: { candidateId, createdAt: range } }),
      prisma.request.count({ where: { candidateId, createdAt: range, status: 'RESOLVED' } }),
      prisma.conversation.count({ where: { candidateId, createdAt: previousRange } }),
    ])

    const resolutionRate = requests > 0 ? Math.round((resolvedRequests / requests) * 100) : 0
    const conversationsChangePercent = prevConversations > 0
      ? Math.round(((conversations - prevConversations) / prevConversations) * 100)
      : null

    return reply.send({ conversations, newContacts, requests, resolutionRate, conversationsChangePercent })
  })

  // Relatório 4: Volume por Canal
  app.get('/analytics/by-channel', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    const range = dateRange(start, end)

    const conversations = await prisma.conversation.findMany({
      where: { candidateId, createdAt: range },
      include: { channel: { select: { type: true, name: true } } },
    })

    const grouped: Record<string, { type: string; name: string; count: number }> = {}
    for (const c of conversations) {
      const key = c.channelId
      if (!grouped[key]) grouped[key] = { type: c.channel.type, name: c.channel.name, count: 0 }
      grouped[key].count++
    }

    return reply.send(Object.values(grouped).sort((a, b) => b.count - a.count))
  })

  // Relatório 8: Eleitores Mais Engajados (Top 20)
  app.get('/analytics/top-contacts', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const contacts = await prisma.contact.findMany({
      where: { candidateId },
      orderBy: { totalInteractions: 'desc' },
      take: 20,
      select: { id: true, name: true, phone: true, totalInteractions: true, firstContactAt: true },
    })

    return reply.send(contacts)
  })

  // Relatório 9: Evolução Semanal (volume de conversas ao longo do tempo)
  app.get('/analytics/timeline', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    const range = dateRange(start, end)

    const conversations = await prisma.conversation.findMany({
      where: { candidateId, createdAt: range },
      select: { createdAt: true },
    })

    const grouped: Record<string, number> = {}
    for (const c of conversations) {
      const day = c.createdAt.toISOString().split('T')[0]
      grouped[day] = (grouped[day] || 0) + 1
    }

    return reply.send(Object.entries(grouped).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)))
  })

  // Relatório 10: Status das Solicitações
  app.get('/analytics/requests-status', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const byStatus = await prisma.request.groupBy({
      by: ['status'],
      where: { candidateId },
      _count: true,
    })

    return reply.send(Object.fromEntries(byStatus.map((s) => [s.status, s._count])))
  })

  // Painel "ao vivo" do dashboard principal (seção 4.2 da spec)
  app.get('/analytics/realtime', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [openConversations, urgentConversations, channels, recentConversations, newContactsToday, openRequests, compliance] = await Promise.all([
      prisma.conversation.count({ where: { candidateId, status: 'ACTIVE' } }),
      prisma.conversation.count({ where: { candidateId, status: 'URGENT' } }),
      prisma.channel.findMany({ where: { candidateId }, select: { id: true, name: true, type: true, isActive: true } }),
      prisma.conversation.findMany({
        where: { candidateId, lastMessageAt: { gte: since24h } },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
        select: { id: true, status: true, lastMessageAt: true, contact: { select: { name: true, phone: true } }, channel: { select: { type: true } } },
      }),
      prisma.contact.count({ where: { candidateId, createdAt: { gte: since24h } } }),
      prisma.request.count({ where: { candidateId, status: { in: ['RECEIVED', 'ANALYZING'] } } }),
      getComplianceStatus(candidateId),
    ])

    return reply.send({ openConversations, urgentConversations, channels, recentConversations, newContactsToday, openRequests, compliance })
  })
}
