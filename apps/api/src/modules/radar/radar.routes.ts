import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Coleta e classifica itens de um feed RSS público
async function coletarRSS(rssUrl: string): Promise<{ titulo: string; texto: string; url: string; autor?: string }[]> {
  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'SyncroFlowEleicoes/1.0 (radar@syncrofloweleicoes.com.br)' },
      signal: AbortSignal.timeout(10000),
    })
    const xml = await res.text()
    // Parse simples de RSS/Atom via regex — evita dependência de biblioteca
    const items: { titulo: string; texto: string; url: string; autor?: string }[] = []
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    while ((m = itemRe.exec(xml)) !== null && items.length < 20) {
      const block = m[1]
      const title = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block) ?? /<title>([\s\S]*?)<\/title>/.exec(block))?.[1]?.trim() ?? ''
      const desc = (/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(block) ?? /<description>([\s\S]*?)<\/description>/.exec(block))?.[1]?.replace(/<[^>]+>/g, '').trim() ?? ''
      const link = (/<link>([\s\S]*?)<\/link>/.exec(block))?.[1]?.trim() ?? ''
      if (title || desc) items.push({ titulo: title, texto: desc || title, url: link })
    }
    return items
  } catch {
    return []
  }
}

async function classificarSentimento(texto: string, nomeMonitorado: string): Promise<{ sentimento: string; relevancia: number }> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `Analise o texto e classifique em relação ao monitorado "${nomeMonitorado}".
Retorne SOMENTE JSON: {"sentimento":"positivo|negativo|neutro","relevancia":0-100}
Relevância alta (>70): ataques, fake news, viralização. Média (40-70): menções gerais. Baixa (<40): ruído.`,
      messages: [{ role: 'user', content: texto.slice(0, 500) }],
    })
    const raw = (message.content[0] as { type: string; text: string }).text
    return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
  } catch {
    return { sentimento: 'neutro', relevancia: 30 }
  }
}

export async function radarRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /radar — lista monitoramentos
  app.get('/radar', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const radares = await prisma.radarMonitorado.findMany({
      where: { candidateId },
      include: { _count: { select: { resultados: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(radares)
  })

  // POST /radar — criar monitoramento
  app.post('/radar', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = z.object({
      tipo: z.enum(['adversario', 'proprio', 'tema', 'palavra_chave']),
      nome: z.string().min(2).max(200),
      rssUrl: z.string().url().optional(),
      twitterQuery: z.string().max(500).optional(),
      plataformas: z.array(z.string()).default([]),
    }).parse(req.body)

    const radar = await prisma.radarMonitorado.create({ data: { candidateId, ...data } })
    await auditLog({ candidateId, eventType: 'radar_criado', metadata: { radarId: radar.id, tipo: data.tipo } })
    return reply.status(201).send(radar)
  })

  // PATCH /radar/:id
  app.patch('/radar/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const data = z.object({
      nome: z.string().optional(),
      rssUrl: z.string().url().optional().nullable(),
      twitterQuery: z.string().optional().nullable(),
      plataformas: z.array(z.string()).optional(),
      ativo: z.boolean().optional(),
    }).parse(req.body)

    const radar = await prisma.radarMonitorado.findFirst({ where: { id, candidateId } })
    if (!radar) return reply.status(404).send({ error: 'Não encontrado' })

    const updated = await prisma.radarMonitorado.update({ where: { id }, data })
    return reply.send(updated)
  })

  // DELETE /radar/:id
  app.delete('/radar/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const radar = await prisma.radarMonitorado.findFirst({ where: { id, candidateId } })
    if (!radar) return reply.status(404).send({ error: 'Não encontrado' })

    await prisma.radarMonitorado.delete({ where: { id } })
    return reply.status(204).send()
  })

  // POST /radar/:id/coletar — coleta manual de um radar específico
  app.post('/radar/:id/coletar', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const radar = await prisma.radarMonitorado.findFirst({ where: { id, candidateId, ativo: true } })
    if (!radar) return reply.status(404).send({ error: 'Radar não encontrado ou inativo' })

    const novos: {
      radarId: string; candidateId: string; plataforma: string; tipo: string
      titulo: string; texto: string; url: string; sentimento: string; relevancia: number
    }[] = []

    if (radar.rssUrl) {
      const itens = await coletarRSS(radar.rssUrl)
      for (const item of itens.slice(0, 10)) {
        const { sentimento, relevancia } = await classificarSentimento(`${item.titulo} ${item.texto}`, radar.nome)
        novos.push({
          radarId: radar.id, candidateId, plataforma: 'google_alerts',
          tipo: 'noticia', titulo: item.titulo, texto: item.texto,
          url: item.url, sentimento, relevancia,
        })
      }
    }

    if (novos.length > 0) {
      await prisma.radarResultado.createMany({ data: novos as any })
      await prisma.radarMonitorado.update({ where: { id }, data: { ultimaColeta: new Date() } })
    }

    return reply.send({ coletados: novos.length })
  })

  // GET /radar/resultados — feed de alertas
  app.get('/radar/resultados', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { lido, sentimento, page } = req.query as { lido?: string; sentimento?: string; page?: string }
    const pageNum = Math.max(1, parseInt(page ?? '1', 10))
    const take = 30

    const where = {
      candidateId,
      ...(lido === 'false' ? { lido: false } : lido === 'true' ? { lido: true } : {}),
      ...(sentimento ? { sentimento } : {}),
    }

    const [items, total, naoLidos] = await Promise.all([
      prisma.radarResultado.findMany({
        where, orderBy: [{ relevancia: 'desc' }, { coletadoEm: 'desc' }],
        take, skip: (pageNum - 1) * take,
        include: { radar: { select: { nome: true, tipo: true } } },
      }),
      prisma.radarResultado.count({ where }),
      prisma.radarResultado.count({ where: { candidateId, lido: false } }),
    ])

    return reply.send({ items, total, naoLidos, page: pageNum, pages: Math.ceil(total / take) })
  })

  // PATCH /radar/resultados/:id/lido
  app.patch('/radar/resultados/:id/lido', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const { lido } = z.object({ lido: z.boolean() }).parse(req.body)

    const r = await prisma.radarResultado.findFirst({ where: { id, candidateId } })
    if (!r) return reply.status(404).send({ error: 'Não encontrado' })

    await prisma.radarResultado.update({ where: { id }, data: { lido } })
    return reply.send({ ok: true })
  })

  // POST /radar/contra-narrativa — gera sugestão de resposta para um resultado
  app.post('/radar/contra-narrativa', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { resultadoId } = z.object({ resultadoId: z.string() }).parse(req.body)

    const resultado = await prisma.radarResultado.findFirst({
      where: { id: resultadoId, candidateId },
      include: { radar: { select: { nome: true, tipo: true } } },
    })
    if (!resultado) return reply.status(404).send({ error: 'Não encontrado' })

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { name: true, position: true, party: true },
    })

    // Retorna sugestão já salva se existir
    if (resultado.sugestaoIA) {
      try { return reply.send(JSON.parse(resultado.sugestaoIA)) } catch { return reply.send({ contranarrativa: resultado.sugestaoIA, tom: 'propositivo', racional: '' }) }
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Você é o assessor de comunicação de ${candidate?.name}, ${candidate?.position ?? ''} (${candidate?.party ?? ''}).
Analise o conteúdo e gere uma contra-narrativa estratégica.
Retorne JSON: {"contranarrativa":"sugestão de post/resposta (máx 500 chars)","tom":"defensivo|propositivo|ignorar","racional":"1 frase explicando a estratégia"}`,
      messages: [{ role: 'user', content: `Conteúdo monitorado (${resultado.radar.nome}):\n${resultado.titulo ?? ''}\n${resultado.texto.slice(0, 600)}` }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text
    let parsed: { contranarrativa: string; tom: string; racional: string }
    try { parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') } catch { parsed = { contranarrativa: raw, tom: 'propositivo', racional: '' } }

    // Persiste para não chamar IA novamente
    await prisma.radarResultado.update({ where: { id: resultadoId }, data: { sugestaoIA: JSON.stringify(parsed) } }).catch(() => {})

    return reply.send(parsed)
  })

  // GET /radar/resumos
  app.get('/radar/resumos', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const resumos = await prisma.resumoRadar.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    return reply.send(resumos)
  })
}
