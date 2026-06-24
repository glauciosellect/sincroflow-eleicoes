import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import rawBody from 'fastify-raw-body'
import { redis } from './lib/redis'
import { logger } from './lib/logger'

import { authRoutes } from './modules/auth/auth.routes'
import { googleRoutes } from './modules/auth/google.routes'
import { candidateRoutes } from './modules/candidates/candidates.routes'
import { agentRoutes } from './modules/agents/agents.routes'
import { channelRoutes } from './modules/channels/channels.routes'
import { conversationRoutes } from './modules/conversations/conversations.routes'
import { contactRoutes } from './modules/contacts/contacts.routes'
import { analyticsRoutes } from './modules/analytics/analytics.routes'
import { billingRoutes } from './modules/billing/billing.routes'
import { stripeRoutes } from './modules/billing/stripe.routes'
import { metaIntegrationRoutes } from './modules/integrations/meta.routes'
import { metaWhatsAppSignupRoutes } from './modules/integrations/meta-whatsapp-signup.routes'
import { apiKeyRoutes } from './modules/auth/apikeys.routes'
import { envVariableRoutes } from './modules/auth/env-variables.routes'
import { webhookRoutes } from './modules/webhooks/webhooks.routes'
import { emailChannelRoutes } from './modules/channels/email/email.routes'
import { rbacRoutes } from './modules/rbac/rbac.routes'
import { statusRoutes } from './modules/status/status.routes'
import { complianceRoutes } from './modules/compliance/compliance.routes'
import { requestRoutes } from './modules/requests/requests.routes'
import { alertRoutes } from './modules/alerts/alerts.routes'
import { startAlertsWorker } from './modules/alerts/alerts.worker'
import { startMessageWorker } from './modules/webhooks/message.worker'
import { startReminderWorker } from './modules/calendar/reminder.worker'
import { startEmailPollingWorker } from './modules/channels/email/email-poll.worker'
import { startComplianceWorker } from './modules/compliance/compliance.worker'
import { initSocket } from './lib/socket'

const app = Fastify({ logger: process.env.NODE_ENV === 'development' })

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: { sub: string }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any
  }
}

async function bootstrap() {
  await redis.connect().catch(() => {})

  await app.register(cors, {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', process.env.FRONTEND_URL || ''].filter(Boolean),
    credentials: true,
  })

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: true,
  })

  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod' })

  // Expõe req.rawBody nas rotas que pedirem (config: { rawBody: true }) — necessário
  // para validar assinaturas HMAC (Stripe, Meta) sobre os bytes exatos recebidos,
  // já que o JSON re-serializado pode não ser idêntico ao original.
  await app.register(rawBody, { field: 'rawBody', global: false, runFirst: true })

  // Rate limit global: 200 req/min por IP
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({ error: 'Muitas requisições. Tente novamente em instantes.' }),
  })

  app.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Não autorizado' })
    }
  })

  app.setErrorHandler((error, req, reply) => {
    logger.error('Request error', { url: req.url, error: error.message, stack: error.stack })
    console.error('[ERRO DETALHADO]', error)
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Dados inválidos', details: JSON.parse(error.message) })
    }
    if (error.message === 'Email já cadastrado' || error.message.includes('inválid') || error.message.includes('não encontrado')) {
      return reply.status(400).send({ error: error.message })
    }
    reply.status(500).send({ error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor' })
  })

  await app.register(authRoutes)
  await app.register(googleRoutes)
  await app.register(candidateRoutes)
  await app.register(agentRoutes)
  await app.register(channelRoutes)
  await app.register(emailChannelRoutes)
  await app.register(conversationRoutes)
  await app.register(contactRoutes)
  await app.register(requestRoutes)
  await app.register(alertRoutes)
  await app.register(analyticsRoutes)
  await app.register(billingRoutes)
  await app.register(stripeRoutes)
  await app.register(metaIntegrationRoutes)
  await app.register(metaWhatsAppSignupRoutes)
  await app.register(apiKeyRoutes)
  await app.register(envVariableRoutes)
  await app.register(webhookRoutes)

  // RBAC (equipe / níveis de acesso)
  await app.register(rbacRoutes)

  // Status Page
  await app.register(statusRoutes)

  // Compliance TSE (desativação automática 72h antes de cada turno)
  await app.register(complianceRoutes)

  startMessageWorker()
  startReminderWorker()
  startEmailPollingWorker()
  startComplianceWorker()
  startAlertsWorker()

  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })

  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean)
  initSocket(app.server, allowedOrigins)

  logger.info(`API rodando na porta ${port}`)
}

bootstrap().catch((err) => {
  logger.error('Falha ao iniciar servidor', err)
  process.exit(1)
})
