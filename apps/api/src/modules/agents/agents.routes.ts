import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { getComplianceStatus } from '../compliance/compliance.service'
import { PLATFORM_TOPICS } from '../../lib/platform-topics'
import { requireModule } from '../../lib/rbac'

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

export async function agentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── Minha História / Disclaimer / Configuração ──────────────────────────

  app.get('/agent/config', { onRequest: [requireModule('story')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const config = await prisma.agentConfig.findUnique({ where: { candidateId } })
    return reply.send(config)
  })

  app.patch('/agent/config', { onRequest: [requireModule('story')] }, async (req, reply) => {
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

  app.patch('/agent/toggle', { onRequest: [requireModule('story')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const config = await prisma.agentConfig.findUnique({ where: { candidateId } })
    if (!config) return reply.status(404).send({ error: 'Agente não configurado' })

    // Não permite reativar manualmente durante a janela de desativação obrigatória do TSE
    if (!config.isActive) {
      const compliance = await getComplianceStatus(candidateId)
      if (compliance.mustBeDeactivated) {
        return reply.status(403).send({ error: 'O agente está desativado por exigência da Resolução TSE nº 23.755/2026 e só pode ser reativado após o pleito.' })
      }
    }

    const updated = await prisma.agentConfig.update({
      where: { candidateId },
      data: { isActive: !config.isActive, ...(config.isActive ? {} : { deactivatedAt: null, deactivationReason: null }) },
    })
    return reply.send(updated)
  })

  // ── Plataforma Eleitoral (15 temas fixos) ────────────────────────────────

  app.get('/agent/platform-topics', { onRequest: [requireModule('platform')] }, async (req, reply) => {
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

  app.patch('/agent/platform-topics/:topicKey', { onRequest: [requireModule('platform')] }, async (req, reply) => {
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

  app.post('/agent/test', { onRequest: [requireModule('story')] }, async (req, reply) => {
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
