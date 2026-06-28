import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { getComplianceStatus } from '../compliance/compliance.service'
import { PLATFORM_TOPICS } from '../../lib/platform-topics'
import { generateReportPdf } from './report-pdf'
import { requireModule, requireAdmin, requireNotRole } from '../../lib/rbac'

// Os 10 relatórios da spec (ver docs/spec-eleicoes/04-modulos/4.9-relatorios.md)
// estão todos implementados:
// 1. Visão Geral da Semana, 2. Temas Mais Perguntados, 3. Solicitações por Região
// (Contact.neighborhood, extraído pela IA ou preenchido manualmente),
// 4. Volume por Canal, 5. Sentimento dos Eleitores (Message.sentiment, classificado
// na mesma chamada de IA que já identifica tema/gap — sem custo extra),
// 6. Perguntas Sem Resposta (Gaps de Conteúdo), 7. Horários de Pico,
// 8. Eleitores Mais Engajados, 9. Evolução Semanal, 10. Status das Solicitações.
//
// Cada relatório também tem uma função pura abaixo (sem depender de req/reply),
// reaproveitada pelo endpoint único /analytics/dashboard — evita que a tela de
// Relatórios precise disparar ~11 requisições HTTP simultâneas (cada uma rápida
// isoladamente, mas a soma gerava lentidão perceptível no carregamento).

function dateRange(start?: string, end?: string) {
  const s = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const e = end ? new Date(end) : new Date()
  return { gte: s, lte: e }
}

export async function getOverview(candidateId: string, range: { gte: Date; lte: Date }) {
  const previousRange = { gte: new Date(range.gte.getTime() - (range.lte.getTime() - range.gte.getTime())), lte: range.gte }

  const [conversations, newContacts, requests, resolvedRequests, prevConversations, prevNewContacts, prevRequests] = await prisma.$transaction([
    prisma.conversation.count({ where: { candidateId, createdAt: range } }),
    prisma.contact.count({ where: { candidateId, createdAt: range } }),
    prisma.request.count({ where: { candidateId, createdAt: range } }),
    prisma.request.count({ where: { candidateId, createdAt: range, status: 'RESOLVED' } }),
    prisma.conversation.count({ where: { candidateId, createdAt: previousRange } }),
    prisma.contact.count({ where: { candidateId, createdAt: previousRange } }),
    prisma.request.count({ where: { candidateId, createdAt: previousRange } }),
  ])

  const resolutionRate = requests > 0 ? Math.round((resolvedRequests / requests) * 100) : 0
  return {
    current: { conversations, newContacts, requests, resolutionRate },
    previous: { conversations: prevConversations, newContacts: prevNewContacts, requests: prevRequests },
  }
}

async function getByChannel(candidateId: string, range: { gte: Date; lte: Date }) {
  const conversations = await prisma.conversation.findMany({
    where: { candidateId, createdAt: range },
    include: { channel: { select: { type: true, name: true } } },
  })
  const grouped: Record<string, { channelId: string; type: string; name: string; count: number }> = {}
  for (const c of conversations) {
    const key = c.channelId
    if (!grouped[key]) grouped[key] = { channelId: c.channelId, type: c.channel.type, name: c.channel.name, count: 0 }
    grouped[key].count++
  }
  return Object.values(grouped).sort((a, b) => b.count - a.count)
}

async function getTopContacts(candidateId: string) {
  return prisma.contact.findMany({
    where: { candidateId },
    orderBy: { totalInteractions: 'desc' },
    take: 20,
    select: { id: true, name: true, phone: true, totalInteractions: true, firstContactAt: true },
  })
}

async function getTimeline(candidateId: string, range: { gte: Date; lte: Date }) {
  const conversations = await prisma.conversation.findMany({
    where: { candidateId, createdAt: range },
    select: { createdAt: true },
  })
  const grouped: Record<string, number> = {}
  for (const c of conversations) {
    const day = c.createdAt.toISOString().split('T')[0]
    grouped[day] = (grouped[day] || 0) + 1
  }
  return Object.entries(grouped).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getRequestsStatus(candidateId: string) {
  const byStatus = await prisma.request.groupBy({ by: ['status'], where: { candidateId }, _count: true })
  return Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
}

export async function getTopTopics(candidateId: string, range: { gte: Date; lte: Date }) {
  const grouped = await prisma.message.groupBy({
    by: ['topicKey'],
    where: { topicKey: { not: null }, createdAt: range, conversation: { candidateId } },
    _count: true,
    orderBy: { _count: { topicKey: 'desc' } },
    take: 10,
  })
  return grouped.map((g) => ({
    topicKey: g.topicKey,
    topicName: PLATFORM_TOPICS.find((t) => t.key === g.topicKey)?.name ?? g.topicKey,
    count: g._count,
  }))
}

export async function getContentGaps(candidateId: string, range: { gte: Date; lte: Date }) {
  const [grouped, examples] = await Promise.all([
    prisma.message.groupBy({
      by: ['topicKey'],
      where: { isContentGap: true, createdAt: range, conversation: { candidateId } },
      _count: true,
      orderBy: { _count: { topicKey: 'desc' } },
      take: 10,
    }),
    prisma.message.findMany({
      where: { isContentGap: true, createdAt: range, conversation: { candidateId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, content: true, topicKey: true, conversationId: true, createdAt: true },
    }),
  ])
  return {
    byTopic: grouped.map((g) => ({
      topicKey: g.topicKey,
      topicName: g.topicKey ? (PLATFORM_TOPICS.find((t) => t.key === g.topicKey)?.name ?? g.topicKey) : 'Sem tema identificado',
      count: g._count,
    })),
    examples,
  }
}

async function getPeakHours(candidateId: string, range: { gte: Date; lte: Date }) {
  // groupBy não suporta extrair "hora" de um DateTime no Prisma — agregamos por dia+hora
  // truncado no próprio banco via $queryRaw seria ideal, mas o volume de mensagens de uma
  // campanha é baixo o suficiente para o cálculo em memória ser desprezível (ms, não segundos).
  const messages = await prisma.message.findMany({
    where: { senderType: 'VOTER', createdAt: range, conversation: { candidateId } },
    select: { createdAt: true },
  })
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  for (const m of messages) byHour[new Date(m.createdAt).getHours()].count++
  return byHour
}

async function getSentiment(candidateId: string, range: { gte: Date; lte: Date }) {
  const grouped = await prisma.message.groupBy({
    by: ['sentiment'],
    where: { senderType: 'VOTER', sentiment: { not: null }, createdAt: range, conversation: { candidateId } },
    _count: true,
  })
  const result = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 } as Record<string, number>
  for (const g of grouped) if (g.sentiment) result[g.sentiment] = g._count
  return result
}

async function getByRegion(candidateId: string, range: { gte: Date; lte: Date }) {
  const requests = await prisma.request.findMany({
    where: { candidateId, createdAt: range },
    select: { contact: { select: { neighborhood: true } } },
  })
  const grouped: Record<string, number> = {}
  let withoutRegion = 0
  for (const r of requests) {
    const neighborhood = r.contact.neighborhood
    if (!neighborhood) { withoutRegion++; continue }
    grouped[neighborhood] = (grouped[neighborhood] || 0) + 1
  }
  return {
    byRegion: Object.entries(grouped).map(([neighborhood, count]) => ({ neighborhood, count })).sort((a, b) => b.count - a.count),
    withoutRegion,
  }
}

// Ranking de Agentes de Campo (captação de eleitores na rua) — agrupa Contact por
// referredByTeamMemberId. Usado tanto na tela "Meu Desempenho" do próprio agente
// quanto no ranking completo visível ao Administrador.
async function getFieldAgentRanking(candidateId: string, range: { gte: Date; lte: Date }) {
  const agents = await prisma.teamMember.findMany({
    where: { candidateId, role: 'AGENTE_CAMPO' },
    select: { id: true, name: true, status: true },
  })

  const contacts = await prisma.contact.findMany({
    where: { candidateId, createdAt: range, referredByTeamMemberId: { not: null } },
    select: { referredByTeamMemberId: true, name: true, phone: true, createdAt: true },
  })

  const grouped: Record<string, { id: string; name: string; status: string; count: number; contacts: { name: string | null; phone: string | null; createdAt: Date }[] }> = {}
  for (const agent of agents) {
    grouped[agent.id] = { id: agent.id, name: agent.name, status: agent.status, count: 0, contacts: [] }
  }
  for (const c of contacts) {
    const agentId = c.referredByTeamMemberId!
    if (!grouped[agentId]) continue
    grouped[agentId].count++
    grouped[agentId].contacts.push({ name: c.name, phone: c.phone, createdAt: c.createdAt })
  }

  return Object.values(grouped).sort((a, b) => b.count - a.count)
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // Endpoint único consolidando os 9 relatórios dependentes de período — a tela de
  // Relatórios usa este em vez de disparar ~9 requisições HTTP separadas.
  app.get('/analytics/dashboard', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    const range = dateRange(start, end)

    const [overview, byChannel, topContacts, timeline, requestsStatus, topTopics, contentGaps, peakHours, sentiment, byRegion] = await Promise.all([
      getOverview(candidateId, range),
      getByChannel(candidateId, range),
      getTopContacts(candidateId),
      getTimeline(candidateId, range),
      getRequestsStatus(candidateId),
      getTopTopics(candidateId, range),
      getContentGaps(candidateId, range),
      getPeakHours(candidateId, range),
      getSentiment(candidateId, range),
      getByRegion(candidateId, range),
    ])

    return reply.send({ overview, byChannel, topContacts, timeline, requestsStatus, topTopics, contentGaps, peakHours, sentiment, byRegion })
  })

  // Relatório 1: Visão Geral da Semana
  app.get('/analytics/overview', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    const { current } = await getOverview(candidateId, dateRange(start, end))
    return reply.send(current)
  })

  // Relatório 4: Volume por Canal
  app.get('/analytics/by-channel', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    return reply.send(await getByChannel(candidateId, dateRange(start, end)))
  })

  // Relatório 8: Eleitores Mais Engajados (Top 20)
  app.get('/analytics/top-contacts', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    return reply.send(await getTopContacts(candidateId))
  })

  // Relatório 9: Evolução Semanal (volume de conversas ao longo do tempo)
  app.get('/analytics/timeline', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    return reply.send(await getTimeline(candidateId, dateRange(start, end)))
  })

  // Relatório 10: Status das Solicitações
  app.get('/analytics/requests-status', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    return reply.send(await getRequestsStatus(candidateId))
  })

  // Relatório 2: Temas Mais Perguntados — agrega Message.topicKey já classificado
  // pela IA (mesmo campo usado pelos alertas de pico de tema).
  app.get('/analytics/top-topics', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    return reply.send(await getTopTopics(candidateId, dateRange(start, end)))
  })

  // Lista os contatos que perguntaram sobre um tema específico no período — usado
  // pelo link "ver eleitores" em Temas Mais Perguntados.
  app.get('/analytics/top-topics/:topicKey/contacts', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { topicKey } = req.params as { topicKey: string }
    const { start, end } = req.query as Record<string, string>
    const range = dateRange(start, end)

    const messages = await prisma.message.findMany({
      where: { topicKey, createdAt: range, conversation: { candidateId } },
      select: { conversation: { select: { id: true, contact: { select: { id: true, name: true, phone: true } } } } },
      distinct: ['conversationId'],
    })

    return reply.send(
      messages.map((m) => ({ conversationId: m.conversation.id, ...m.conversation.contact }))
    )
  })

  // Relatório 6: Perguntas Sem Resposta (gaps de conteúdo) — mensagens marcadas
  // isContentGap=true pela IA (mesmo campo usado pelos alertas de gap).
  app.get('/analytics/content-gaps', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    return reply.send(await getContentGaps(candidateId, dateRange(start, end)))
  })

  // Relatório 7: Horários de Pico — volume de mensagens de eleitores por hora do dia
  app.get('/analytics/peak-hours', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    return reply.send(await getPeakHours(candidateId, dateRange(start, end)))
  })

  // Relatório 5: Sentimento dos Eleitores — Message.sentiment classificado pela IA
  // na mesma chamada que já identifica tema/gap/urgência (sem custo extra de IA).
  app.get('/analytics/sentiment', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    return reply.send(await getSentiment(candidateId, dateRange(start, end)))
  })

  // Relatório 3: Solicitações por Região — agrega Contact.neighborhood (extraído pela
  // IA ao registrar uma solicitação, ou preenchido manualmente pela equipe).
  app.get('/analytics/by-region', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    return reply.send(await getByRegion(candidateId, dateRange(start, end)))
  })

  // Lista os eleitores que fizeram solicitação em um bairro específico no período —
  // usado pelo link "ver eleitores" em Solicitações por Região.
  app.get('/analytics/by-region/:neighborhood/contacts', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { neighborhood } = req.params as { neighborhood: string }
    const { start, end } = req.query as Record<string, string>
    const range = dateRange(start, end)

    const requests = await prisma.request.findMany({
      where: { candidateId, createdAt: range, contact: { neighborhood } },
      select: {
        id: true, protocolNumber: true, subject: true, status: true, conversationId: true,
        contact: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(requests)
  })

  // Exporta o relatório do período em PDF (visão geral, status, temas, gaps, top eleitores)
  app.get('/analytics/export-pdf', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>

    const pdfBuffer = await generateReportPdf(candidateId, start, end)

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="relatorio-campanha.pdf"')
      .send(pdfBuffer)
  })

  // Painel "ao vivo" do dashboard principal (seção 4.2 da spec)
  // Painel "ao vivo" é acessível a qualquer role com algum módulo de gestão — só
  // Agente de Campo é bloqueado (ele só vê o próprio desempenho).
  app.get('/analytics/realtime', { onRequest: [requireNotRole('AGENTE_CAMPO')] }, async (req, reply) => {
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

  // Desempenho do próprio Agente de Campo logado — quantos eleitores ele captou.
  app.get('/analytics/my-field-performance', { onRequest: [requireModule('field_agent')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    const range = dateRange(start, end)

    const member = await prisma.teamMember.findFirst({ where: { userId: sub, candidateId, role: 'AGENTE_CAMPO' } })
    if (!member) return reply.status(403).send({ error: 'Apenas Agentes de Campo têm acesso a este relatório' })

    const ranking = await getFieldAgentRanking(candidateId, range)
    const mine = ranking.find((r) => r.id === member.id) ?? { id: member.id, name: member.name, status: member.status, count: 0, contacts: [] }
    return reply.send(mine)
  })

  // Ranking de todos os Agentes de Campo — visível só ao Administrador, para
  // decidir bonificação por desempenho.
  app.get('/analytics/field-agent-ranking', { onRequest: [requireAdmin()] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { start, end } = req.query as Record<string, string>
    return reply.send(await getFieldAgentRanking(candidateId, dateRange(start, end)))
  })
}
