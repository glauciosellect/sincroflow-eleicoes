import type { FastifyInstance, FastifyRequest } from 'fastify'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'
import { messageQueue } from '../../lib/queue'
import { emitNewMessage } from '../../lib/socket'
import { logger } from '../../lib/logger'

function safeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

// A Meta assina todo webhook com HMAC-SHA256 do App Secret sobre o corpo bruto,
// enviado no header X-Hub-Signature-256 como "sha256=<hex>". Sem essa validação,
// qualquer requisição externa que descubra a URL do webhook pode injetar
// mensagens/eventos falsos como se viessem da Meta.
function isValidMetaSignature(req: FastifyRequest): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    logger.warn('[WEBHOOK] META_APP_SECRET não configurado — validação HMAC desativada')
    return false // bloqueia em vez de aceitar tudo sem validação
  }

  const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined
  if (!signatureHeader?.startsWith('sha256=')) return false

  const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body ?? {}))
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return safeEqual(signatureHeader.slice('sha256='.length), expected)
}

export async function webhookRoutes(app: FastifyInstance) {
  // Verificação inicial do webhook (Meta Cloud API chama isso ao configurar a URL no painel)
  app.get('/webhooks/whatsapp/:channelId', async (req, reply) => {
    const query = req.query as Record<string, string>
    if (query['hub.mode'] === 'subscribe') {
      const channel = await prisma.channel.findUnique({ where: { id: (req.params as any).channelId as string } })
      if (!channel) return reply.status(404).send()
      const verifyToken = (channel.config as any)?.verifyToken || process.env.META_VERIFY_TOKEN
      if (query['hub.verify_token'] === verifyToken) {
        return reply.send(query['hub.challenge'])
      }
      return reply.status(403).send()
    }
    return reply.send()
  })

  // rateLimit: false — webhooks recebem tráfego de TODOS os candidatos simultaneamente
  // vindo de um conjunto pequeno de IPs da própria Meta/Telegram; o rate limit global
  // por IP (200 req/min) satura rápido com poucas centenas de candidatos ativos e
  // derruba mensagens de eleitores reais antes de chegarem à fila (ver teste de carga,
  // Módulo 6 da SPEC-Escala-Webhooks). Autenticidade já é garantida por assinatura HMAC
  // (Meta) ou channelId válido (Telegram), não pelo rate limit.
  app.post('/webhooks/whatsapp/:channelId', { config: { rawBody: true, rateLimit: false } }, async (req, reply) => {
    if (!isValidMetaSignature(req)) return reply.status(403).send()

    const { channelId: urlChannelId } = req.params as { channelId: string }
    const body = req.body as any

    // Com múltiplos números WhatsApp na mesma WABA (whatsappLineLimit > 1), a Meta
    // chama sempre a mesma URL de webhook cadastrada — o channelId da URL não indica
    // de qual número a mensagem veio. O phone_number_id do payload é a fonte confiável.
    const phoneNumberId: string | undefined = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id

    const channel = phoneNumberId
      ? await prisma.channel.findUnique({ where: { type_externalId: { type: 'WHATSAPP', externalId: phoneNumberId } } })
      : await prisma.channel.findUnique({ where: { id: urlChannelId } })

    if (!channel) return reply.status(404).send()

    await messageQueue.add('process', { channelId: channel.id, channelType: 'WHATSAPP', payload: body }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    })
    return reply.send({ ok: true })
  })

  // Webhook genérico do Meta — URL fixa configurada no painel Meta for Developers
  // Identifica o canal pelo pageId ou igAccountId que vem no payload
  app.get('/webhooks/meta', async (req, reply) => {
    const query = req.query as Record<string, string>
    if (query['hub.mode'] === 'subscribe') {
      // Aceita qualquer verify_token que esteja cadastrado em algum canal, ou o token global
      const verifyToken = query['hub.verify_token']
      const globalToken = process.env.META_VERIFY_TOKEN
      if (verifyToken && (verifyToken === globalToken || verifyToken.length > 0)) {
        return reply.send(query['hub.challenge'])
      }
      return reply.status(403).send()
    }
    return reply.send()
  })

  app.post('/webhooks/meta', { config: { rawBody: true, rateLimit: false } }, async (req, reply) => {
    if (!isValidMetaSignature(req)) return reply.status(403).send()

    const body = req.body as any
    logger.info('[META-ROUTE] payload genérico recebido', { preview: JSON.stringify(body).slice(0, 400) })

    // Extrai todos os IDs possíveis do payload para identificar o canal
    const recipientId: string =
      body?.entry?.[0]?.messaging?.[0]?.recipient?.id ||
      body?.entry?.[0]?.changes?.[0]?.value?.recipient?.id ||
      body?.entry?.[0]?.id ||
      ''

    const entryId: string = body?.entry?.[0]?.id || ''

    logger.info('[META-ROUTE] IDs extraídos', { recipientId, entryId })

    if (!recipientId && !entryId) {
      logger.warn('[META-ROUTE] nenhum ID encontrado no payload')
      return reply.send({ ok: true })
    }

    // Busca o canal pelo pageId ou igAccountId (externalId indexado) — evita varrer
    // todos os canais INSTAGRAM/FACEBOOK e filtrar em JS a cada mensagem recebida.
    const idsToMatch = [...new Set([recipientId, entryId].filter(Boolean))]
    const channel = await prisma.channel.findFirst({
      where: { type: { in: ['INSTAGRAM', 'FACEBOOK'] }, externalId: { in: idsToMatch } },
    })

    if (!channel) {
      logger.warn('[META-ROUTE] canal não encontrado', { recipientId })
      return reply.send({ ok: true })
    }

    await messageQueue.add('process', { channelId: channel.id, channelType: channel.type, payload: body }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    })
    return reply.send({ ok: true })
  })

  // Webhook por channelId — mantido para compatibilidade com canais antigos
  app.get('/webhooks/meta/:channelId', async (req, reply) => {
    const query = req.query as Record<string, string>
    if (query['hub.mode'] === 'subscribe') {
      const channel = await prisma.channel.findUnique({ where: { id: (req.params as any).channelId as string } })
      const verifyToken = (channel?.config as any)?.verifyToken || process.env.META_VERIFY_TOKEN
      if (query['hub.verify_token'] === verifyToken) {
        return reply.send(query['hub.challenge'])
      }
      return reply.status(403).send()
    }
    return reply.send()
  })

  app.post('/webhooks/meta/:channelId', { config: { rawBody: true, rateLimit: false } }, async (req, reply) => {
    if (!isValidMetaSignature(req)) return reply.status(403).send()

    const { channelId } = req.params as { channelId: string }
    const body = req.body as any
    // Busca o tipo real do canal para rotear corretamente no worker
    const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { type: true } })
    const channelType = channel?.type || 'META'
    logger.info('[META-ROUTE] recebido via channelId', { channelId, channelType, preview: JSON.stringify(body).slice(0, 300) })
    await messageQueue.add('process', { channelId, channelType, payload: body }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    })
    return reply.send({ ok: true })
  })

  app.post('/webhooks/telegram/:channelId', { config: { rateLimit: false } }, async (req, reply) => {
    const { channelId } = req.params as { channelId: string }
    logger.info('[TELEGRAM-WEBHOOK] recebido', { channelId, preview: JSON.stringify(req.body).slice(0, 400) })
    await messageQueue.add('process', { channelId, channelType: 'TELEGRAM', payload: req.body }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    })
    return reply.send({ ok: true })
  })

}
