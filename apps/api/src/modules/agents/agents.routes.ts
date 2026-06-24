import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'

const configSchema = z.object({
  agentName: z.string().min(1).max(100).optional(),
  agentRole: z.string().max(200).optional(),
  agentStyle: z.enum(['FORMAL', 'INFORMAL', 'ACOLHEDOR']).optional(),
  story: z.string().max(20000).optional().nullable(),
  disclaimer: z.string().min(1).max(2000).optional(),
  candidateSite: z.string().url().or(z.literal('')).optional().nullable(),
  voiceEnabled: z.boolean().optional(),
  ttsVoice: z.string().optional(),
  responseDelay: z.number().int().min(0).max(300).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
})

// 15 temas fixos da Plataforma Eleitoral (ver docs/spec-eleicoes/04-modulos/4.3-cadastro-agente.md)
export const PLATFORM_TOPICS: { key: string; name: string }[] = [
  { key: 'saude', name: 'Saúde' },
  { key: 'seguranca_publica', name: 'Segurança Pública' },
  { key: 'educacao', name: 'Educação' },
  { key: 'economia_emprego', name: 'Economia e Emprego' },
  { key: 'habitacao_urbanismo', name: 'Habitação e Urbanismo' },
  { key: 'reforma_tributaria', name: 'Reforma Tributária' },
  { key: 'infraestrutura_mobilidade', name: 'Infraestrutura e Mobilidade' },
  { key: 'protecao_ambiental', name: 'Proteção Ambiental' },
  { key: 'familia_valores', name: 'Família e Valores' },
  { key: 'transparencia_corrupcao', name: 'Transparência e Combate à Corrupção' },
  { key: 'direitos_humanos_inclusao', name: 'Direitos Humanos e Inclusão' },
  { key: 'tecnologia_inovacao', name: 'Tecnologia e Inovação' },
  { key: 'agricultura_agronegocio', name: 'Agricultura e Agronegócio' },
  { key: 'cultura_esporte', name: 'Cultura e Esporte' },
  { key: 'outras_propostas', name: 'Outras Propostas' },
]

export async function agentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── Minha História / Disclaimer / Configuração ──────────────────────────

  app.get('/agent/config', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const config = await prisma.agentConfig.findUnique({ where: { candidateId } })
    return reply.send(config)
  })

  app.patch('/agent/config', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const data = configSchema.parse(req.body)
    const config = await prisma.agentConfig.upsert({
      where: { candidateId },
      update: data,
      create: { candidateId, disclaimer: data.disclaimer || '', ...data },
    })
    return reply.send(config)
  })

  app.patch('/agent/toggle', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const config = await prisma.agentConfig.findUnique({ where: { candidateId } })
    if (!config) return reply.status(404).send({ error: 'Agente não configurado' })
    const updated = await prisma.agentConfig.update({
      where: { candidateId },
      data: { isActive: !config.isActive },
    })
    return reply.send(updated)
  })

  // ── Plataforma Eleitoral (15 temas fixos) ────────────────────────────────

  app.get('/agent/platform-topics', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const saved = await prisma.platformTopic.findMany({ where: { candidateId } })
    const savedByKey = new Map(saved.map(t => [t.topicKey, t]))
    const topics = PLATFORM_TOPICS.map(t => ({
      topicKey: t.key,
      topicName: t.name,
      content: savedByKey.get(t.key)?.content ?? null,
      updatedAt: savedByKey.get(t.key)?.updatedAt ?? null,
    }))
    return reply.send(topics)
  })

  app.patch('/agent/platform-topics/:topicKey', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { topicKey } = req.params as { topicKey: string }
    const topicDef = PLATFORM_TOPICS.find(t => t.key === topicKey)
    if (!topicDef) return reply.status(404).send({ error: 'Tema não encontrado' })
    const { content } = z.object({ content: z.string().max(8000) }).parse(req.body)
    const topic = await prisma.platformTopic.upsert({
      where: { candidateId_topicKey: { candidateId, topicKey } },
      update: { content },
      create: { candidateId, topicKey, topicName: topicDef.name, content },
    })
    return reply.send(topic)
  })

  // ── Testar agente ─────────────────────────────────────────────────────

  app.post('/agent/test', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { message, history } = z.object({
      message: z.string(),
      history: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
    }).parse(req.body)

    const [candidate, config, topics] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: candidateId } }),
      prisma.agentConfig.findUnique({ where: { candidateId } }),
      prisma.platformTopic.findMany({ where: { candidateId } }),
    ])
    if (!candidate || !config) return reply.status(404).send({ error: 'Agente não configurado' })

    const { testAgent } = await import('../ai/ai.service')
    const result = await testAgent(candidate, config, topics, message, history)
    return reply.send(result)
  })
}
