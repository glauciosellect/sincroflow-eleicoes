import type { FastifyInstance } from 'fastify'
import { logger } from '../../lib/logger'
import { Webhook } from 'svix'
import { z } from 'zod'
import axios from 'axios'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { assertWhatsAppLimit } from '../../lib/whatsapp-limit'
import {
  createVirtualPhoneAccount,
  cancelVirtualPhoneAccount,
  getVirtualPhoneAccount,
  listAvailableAreaCodes,
} from './salvy.service'

const SALVY_WEBHOOK_SECRET = process.env.SALVY_WEBHOOK_SECRET!
const META_APP_ID = process.env.META_APP_ID!
const META_APP_SECRET = process.env.META_APP_SECRET!
const META_WHATSAPP_API_VERSION = process.env.META_WHATSAPP_API_VERSION || 'v21.0'
const GRAPH_URL = `https://graph.facebook.com/${META_WHATSAPP_API_VERSION}`

// Registra o número virtual na WABA da SyncroFlow após confirmação do código SMS.
// Retorna phoneNumberId e accessToken que ficam em Channel.config.
async function registerNumberOnWaba(phoneNumber: string, verificationCode: string): Promise<{
  phoneNumberId: string
  accessToken: string
  wabaId: string
}> {
  // Obtém token de sistema de longa duração via App ID + Secret
  const tokenRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      grant_type: 'client_credentials',
    },
  })
  const systemToken: string = tokenRes.data.access_token

  // Registra o número na WABA (a WABA_ID fica em META_WABA_ID env ou é buscada via API)
  const wabaId = process.env.META_WABA_ID!
  const registerRes = await axios.post(
    `${GRAPH_URL}/${wabaId}/phone_numbers`,
    {
      phone_number: phoneNumber,
      verification_code: verificationCode,
      cc: '55',
    },
    { headers: { Authorization: `Bearer ${systemToken}` } },
  )

  const phoneNumberId: string = registerRes.data.id

  return { phoneNumberId, accessToken: systemToken, wabaId }
}

// Assina o app no WABA para receber mensagens via webhook
async function subscribeAppToWaba(wabaId: string, accessToken: string) {
  try {
    await axios.post(
      `${GRAPH_URL}/${wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
  } catch (err: any) {
    logger.error('[SALVY] Erro ao assinar app no WABA:', err?.response?.data || err?.message)
  }
}

export async function salvyRoutes(app: FastifyInstance) {
  // Lista DDDs disponíveis para o candidato escolher ao adquirir número
  app.get('/integrations/salvy/area-codes', { onRequest: [app.authenticate] }, async (_req, reply) => {
    const areaCodes = await listAvailableAreaCodes()
    return reply.send({ areaCodes })
  })

  // Lista os canais WhatsApp do candidato que foram provisionados via Salvy
  app.get('/integrations/salvy/virtual-numbers', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const channels = await prisma.channel.findMany({
      where: {
        candidateId,
        type: 'WHATSAPP',
        config: { path: ['salvyVirtualPhoneAccountId'], not: Prisma.JsonNull },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(channels)
  })

  // Candidato clica "Adquirir novo número" — provisiona na Salvy e cria Channel pendente
  app.post('/integrations/salvy/virtual-numbers', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { areaCode } = z.object({ areaCode: z.number().int() }).parse(req.body)

    // Verifica limite de linhas do plano antes de provisionar
    try {
      await assertWhatsAppLimit(candidateId)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }

    const account = await createVirtualPhoneAccount(areaCode, `SyncroFlowEleicoes-${candidateId.slice(0, 8)}`)

    // Canal criado como inativo — só ativa após confirmação do código SMS na Meta
    const channel = await prisma.channel.create({
      data: {
        candidateId,
        type: 'WHATSAPP',
        name: account.phoneNumber,
        isActive: false,
        config: {
          provider: 'meta-cloud',
          salvyVirtualPhoneAccountId: account.id,
          salvyStatus: account.status,
          displayPhoneNumber: account.phoneNumber,
          // phoneNumberId e accessToken serão preenchidos após ativação pós-SMS
          phoneNumberId: null,
          accessToken: null,
          wabaId: null,
          verificationCode: null,
        },
      },
    })

    return reply.status(201).send({ channel, salvyAccount: account })
  })

  // Após receber o código SMS (via webhook abaixo), o candidato confirma no painel
  // para finalizar o registro do número na WABA e ativar o canal
  app.post('/integrations/salvy/virtual-numbers/:channelId/activate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { channelId } = z.object({ channelId: z.string() }).parse(req.params)
    const { verificationCode } = z.object({ verificationCode: z.string().min(1) }).parse(req.body)

    const channel = await prisma.channel.findFirst({ where: { id: channelId, candidateId } })
    if (!channel) return reply.status(404).send({ error: 'Canal não encontrado' })

    const config = channel.config as any
    if (config?.isActive) return reply.status(400).send({ error: 'Canal já está ativo' })

    const phoneNumber = config?.displayPhoneNumber
    if (!phoneNumber) return reply.status(400).send({ error: 'Número de telefone não encontrado na configuração do canal' })

    let wabaData: { phoneNumberId: string; accessToken: string; wabaId: string }
    try {
      wabaData = await registerNumberOnWaba(phoneNumber, verificationCode)
    } catch (err: any) {
      logger.error('[SALVY] Erro ao registrar número na WABA:', err?.response?.data || err?.message)
      return reply.status(400).send({ error: 'Código de verificação inválido ou expirado. Tente solicitar um novo SMS.' })
    }

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: {
        isActive: true,
        config: {
          ...config,
          provider: 'meta-cloud',
          phoneNumberId: wabaData.phoneNumberId,
          accessToken: wabaData.accessToken,
          wabaId: wabaData.wabaId,
          salvyStatus: 'active',
          verificationCode: null,
        },
      },
    })

    await subscribeAppToWaba(wabaData.wabaId, wabaData.accessToken)

    return reply.send(updated)
  })

  // Cancela número virtual Salvy e desativa o canal correspondente
  app.delete('/integrations/salvy/virtual-numbers/:channelId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { channelId } = z.object({ channelId: z.string() }).parse(req.params)

    const channel = await prisma.channel.findFirst({ where: { id: channelId, candidateId } })
    if (!channel) return reply.status(404).send({ error: 'Canal não encontrado' })

    const config = channel.config as any
    const salvyId = config?.salvyVirtualPhoneAccountId
    if (!salvyId) return reply.status(400).send({ error: 'Canal não possui número virtual Salvy associado' })

    // Status intermediário antes de confirmar cancelamento — evita inconsistência se a chamada falhar
    await prisma.channel.update({
      where: { id: channelId },
      data: { config: { ...config, salvyStatus: 'cancelamento_solicitado' } },
    })

    await cancelVirtualPhoneAccount(salvyId, 'company-canceled')

    const confirmed = await getVirtualPhoneAccount(salvyId)
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        isActive: false,
        config: { ...config, salvyStatus: confirmed.status },
      },
    })

    return reply.send({ status: confirmed.status })
  })

  // Webhook da Salvy (assinado via Svix) — recebe sms.received com o código de verificação do WhatsApp.
  // Ao receber o código, salva no channel.config para o candidato confirmar no painel.
  app.post('/webhooks/salvy', { config: { rawBody: true } }, async (req, reply) => {
    const wh = new Webhook(SALVY_WEBHOOK_SECRET)
    let payload: any
    try {
      payload = wh.verify((req as any).rawBody, req.headers as Record<string, string>)
    } catch (err) {
      logger.error('[SALVY-WEBHOOK] Falha na verificação de assinatura', { error: (err as any)?.message })
      return reply.status(401).send({ error: 'Assinatura inválida' })
    }

    if (payload.type === 'sms.received') {
      const { virtualPhoneAccountId, message, detections } = payload.data
      const verificationCode: string | undefined = detections?.whatsapp?.verificationCode

      logger.info(`[SALVY-WEBHOOK] SMS recebido para ${virtualPhoneAccountId}: "${message}"${verificationCode ? ` (código WhatsApp: ${verificationCode})` : ''}`)

      if (verificationCode) {
        // Localiza o canal pelo salvyVirtualPhoneAccountId e salva o código para o candidato usar na tela
        const channels = await prisma.channel.findMany({
          where: { type: 'WHATSAPP' },
        })
        const channel = channels.find((c) => {
          const cfg = c.config as any
          return cfg?.salvyVirtualPhoneAccountId === virtualPhoneAccountId
        })

        if (channel) {
          const config = channel.config as any
          await prisma.channel.update({
            where: { id: channel.id },
            data: {
              config: {
                ...config,
                verificationCode,
                verificationCodeReceivedAt: new Date().toISOString(),
              },
            },
          })
          logger.info(`[SALVY-WEBHOOK] Código ${verificationCode} salvo no canal ${channel.id}`)
        } else {
          logger.warn(`[SALVY-WEBHOOK] Canal não encontrado para salvyVirtualPhoneAccountId: ${virtualPhoneAccountId}`)
        }
      }
    }

    return reply.status(200).send({ received: true })
  })

  // Polling: retorna o código SMS recebido (se houver) para o frontend exibir ao candidato
  app.get('/integrations/salvy/virtual-numbers/:channelId/verification-code', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { channelId } = z.object({ channelId: z.string() }).parse(req.params)

    const channel = await prisma.channel.findFirst({ where: { id: channelId, candidateId } })
    if (!channel) return reply.status(404).send({ error: 'Canal não encontrado' })

    const config = channel.config as any
    return reply.send({
      verificationCode: config?.verificationCode ?? null,
      verificationCodeReceivedAt: config?.verificationCodeReceivedAt ?? null,
      salvyStatus: config?.salvyStatus ?? null,
      isActive: channel.isActive,
    })
  })
}
