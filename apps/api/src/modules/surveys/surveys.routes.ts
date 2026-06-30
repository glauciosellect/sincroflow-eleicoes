import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, requireAdmin, auditLog } from '../../lib/rbac'

export async function surveyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // Agente de campo registra uma intenção de voto
  app.post('/surveys/vote', { onRequest: [requireModule('field_agent')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { voterName, voterPhone, neighborhood, intention, notes } = z.object({
      voterName: z.string().optional(),
      voterPhone: z.string().optional(),
      neighborhood: z.string().optional(),
      intention: z.enum(['APOIADOR', 'INDECISO', 'CRITICO']),
      notes: z.string().optional(),
    }).parse(req.body)

    const member = await prisma.teamMember.findFirst({
      where: { candidateId, userId: sub, status: 'ACTIVE' },
    })

    const response = await prisma.voteSurveyResponse.create({
      data: {
        candidateId,
        collectedById: member?.id ?? null,
        voterName,
        voterPhone,
        neighborhood,
        intention,
        notes,
      },
    })

    await auditLog({ candidateId, eventType: 'vote_survey_created', metadata: { intention, collectedById: member?.id } })

    return reply.status(201).send(response)
  })

  // Lista todas as respostas (admin/relatórios)
  app.get('/surveys/vote', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { since, collectedById } = req.query as { since?: string; collectedById?: string }

    const responses = await prisma.voteSurveyResponse.findMany({
      where: {
        candidateId,
        ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        ...(collectedById ? { collectedById } : {}),
      },
      include: { collectedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    return reply.send(responses)
  })

  // Resumo por intenção — usado pelo dashboard e termômetro
  app.get('/surveys/vote/summary', { onRequest: [requireModule('platform')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { since } = req.query as { since?: string }
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [totals, byNeighborhood, byAgent, trend] = await Promise.all([
      prisma.voteSurveyResponse.groupBy({
        by: ['intention'],
        where: { candidateId, createdAt: { gte: sinceDate } },
        _count: true,
      }),
      prisma.voteSurveyResponse.groupBy({
        by: ['neighborhood', 'intention'],
        where: { candidateId, neighborhood: { not: null }, createdAt: { gte: sinceDate } },
        _count: true,
        orderBy: { _count: { intention: 'desc' } },
        take: 20,
      }),
      prisma.voteSurveyResponse.groupBy({
        by: ['collectedById', 'intention'],
        where: { candidateId, collectedById: { not: null }, createdAt: { gte: sinceDate } },
        _count: true,
      }),
      // Tendência diária dos últimos 7 dias
      prisma.$queryRaw<{ date: string; intention: string; count: bigint }[]>`
        SELECT DATE("createdAt")::text as date, intention::text, COUNT(*) as count
        FROM "VoteSurveyResponse"
        WHERE "candidateId" = ${candidateId}
          AND "createdAt" >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE("createdAt"), intention
        ORDER BY DATE("createdAt") ASC
      `,
    ])

    const totalMap = Object.fromEntries(totals.map(t => [t.intention, t._count]))
    const apoiador = totalMap['APOIADOR'] ?? 0
    const indeciso = totalMap['INDECISO'] ?? 0
    const critico = totalMap['CRITICO'] ?? 0
    const total = apoiador + indeciso + critico

    // Agentes com nomes — busca em batch
    const agentIds = [...new Set(byAgent.map(a => a.collectedById).filter(Boolean))] as string[]
    const agents = agentIds.length > 0
      ? await prisma.teamMember.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
      : []
    const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]))

    const byAgentSummary = byAgent.reduce<Record<string, { name: string; APOIADOR: number; INDECISO: number; CRITICO: number; total: number }>>((acc, row) => {
      const id = row.collectedById!
      if (!acc[id]) acc[id] = { name: agentMap[id] ?? 'Desconhecido', APOIADOR: 0, INDECISO: 0, CRITICO: 0, total: 0 }
      acc[id][row.intention as 'APOIADOR' | 'INDECISO' | 'CRITICO'] += row._count
      acc[id].total += row._count
      return acc
    }, {})

    return reply.send({
      period: { since: sinceDate.toISOString() },
      totals: { apoiador, indeciso, critico, total },
      percentages: total > 0 ? {
        apoiador: Math.round((apoiador / total) * 100),
        indeciso: Math.round((indeciso / total) * 100),
        critico: Math.round((critico / total) * 100),
      } : { apoiador: 0, indeciso: 0, critico: 0 },
      byNeighborhood,
      byAgent: Object.values(byAgentSummary).sort((a, b) => b.total - a.total),
      trend: trend.map(t => ({ date: t.date, intention: t.intention, count: Number(t.count) })),
    })
  })

  // Apagar uma resposta (admin)
  app.delete('/surveys/vote/:id', { onRequest: [requireAdmin()] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const row = await prisma.voteSurveyResponse.findFirst({ where: { id, candidateId } })
    if (!row) return reply.status(404).send({ error: 'Resposta não encontrada' })

    await prisma.voteSurveyResponse.delete({ where: { id } })
    return reply.status(204).send()
  })
}
