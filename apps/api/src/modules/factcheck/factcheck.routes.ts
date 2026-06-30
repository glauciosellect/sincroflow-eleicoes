import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Você é um consultor de fatos especializado em política brasileira e eleições municipais de 2026.

Seu papel é analisar dúvidas, boatos e afirmações que chegam a agentes eleitorais em campo, e fornecer:
1. Um veredicto claro baseado em fatos públicos verificáveis
2. Uma análise objetiva e imparcial
3. Uma sugestão de resposta que o agente pode usar com o eleitor

Regras:
- Baseie-se apenas em fatos verificáveis: legislação, dados do TSE, IBGE, portais oficiais, notícias de veículos reconhecidos
- Seja honesto: se não há como verificar, diga "INCONCLUSIVO" — nunca invente fatos
- A resposta sugerida deve ser respeitosa, clara e adequada para um eleitor comum
- Cite as fontes que embasam sua análise (portais, leis, órgãos)
- Seja conciso — agente está em campo e precisa da informação rápida

Formato de resposta (JSON válido, sem markdown extra):
{
  "verdict": "VERDADEIRO" | "FALSO" | "PARCIALMENTE_VERDADEIRO" | "INCONCLUSIVO",
  "analysis": "análise em 2-4 frases explicando o que é verdade e o que não é",
  "suggestedReply": "texto pronto para o agente enviar/falar ao eleitor (2-3 frases, linguagem simples)",
  "sources": ["fonte 1", "fonte 2"]
}`

export async function factCheckRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // Analisa uma dúvida/boato usando IA
  app.post('/factcheck/analyze', { onRequest: [requireModule('field_agent')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { query, saveToLibrary, tags } = z.object({
      query: z.string().min(5).max(2000),
      saveToLibrary: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
    }).parse(req.body)

    const member = await prisma.teamMember.findFirst({
      where: { candidateId, userId: sub, status: 'ACTIVE' },
      select: { id: true, name: true },
    })

    // Busca contexto do candidato para personalizar análise
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { name: true, city: true, state: true },
    })

    const userMessage = candidate?.city
      ? `Contexto: campanha em ${candidate.city}/${candidate.state ?? 'BR'}.\n\nDúvida/boato recebido:\n${query}`
      : query

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text

    let parsed: { verdict: string; analysis: string; suggestedReply: string; sources: string[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Tenta extrair JSON mesmo que venha com markdown
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) return reply.status(500).send({ error: 'IA retornou resposta inválida. Tente novamente.' })
      parsed = JSON.parse(match[0])
    }

    const record = await prisma.factCheck.create({
      data: {
        candidateId,
        checkedById: member?.id ?? null,
        query,
        verdict: parsed.verdict,
        analysis: parsed.analysis,
        suggestedReply: parsed.suggestedReply,
        sources: parsed.sources ?? [],
        savedToLibrary: saveToLibrary,
        tags,
      },
    })

    await auditLog({ candidateId, eventType: 'fact_check_created', metadata: { verdict: parsed.verdict, checkedById: member?.id } })

    return reply.status(201).send({ ...record, ...parsed })
  })

  // Lista histórico / biblioteca
  app.get('/factcheck', { onRequest: [requireModule('field_agent')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { libraryOnly, search } = req.query as { libraryOnly?: string; search?: string }

    const records = await prisma.factCheck.findMany({
      where: {
        candidateId,
        ...(libraryOnly === 'true' ? { savedToLibrary: true } : {}),
        ...(search ? { query: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { checkedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return reply.send(records)
  })

  // Salva/remove da biblioteca
  app.patch('/factcheck/:id/library', { onRequest: [requireModule('field_agent')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const { saved } = z.object({ saved: z.boolean() }).parse(req.body)

    const record = await prisma.factCheck.findFirst({ where: { id, candidateId } })
    if (!record) return reply.status(404).send({ error: 'Não encontrado' })

    const updated = await prisma.factCheck.update({ where: { id }, data: { savedToLibrary: saved } })
    return reply.send(updated)
  })

  // Deleta (admin)
  app.delete('/factcheck/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const record = await prisma.factCheck.findFirst({ where: { id, candidateId } })
    if (!record) return reply.status(404).send({ error: 'Não encontrado' })

    await prisma.factCheck.delete({ where: { id } })
    return reply.status(204).send()
  })

  // Estatísticas para relatórios
  app.get('/factcheck/stats', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const [byVerdict, total, topQueries] = await Promise.all([
      prisma.factCheck.groupBy({
        by: ['verdict'],
        where: { candidateId },
        _count: true,
      }),
      prisma.factCheck.count({ where: { candidateId } }),
      prisma.factCheck.findMany({
        where: { candidateId, savedToLibrary: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, query: true, verdict: true, createdAt: true },
      }),
    ])

    return reply.send({ total, byVerdict, topQueries })
  })
}
