import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { assertWhatsAppLimit, WhatsAppLimitExceededError } from '../../lib/whatsapp-limit'
import { MetaCloudApiProvider } from '../channels/whatsapp/providers/meta-cloud.provider'
import { requireAdmin } from '../../lib/rbac'

const META_APP_ID = process.env.META_APP_ID!
const META_APP_SECRET = process.env.META_APP_SECRET!

// Embedded Signup roda em popup (sem redirect_uri) — troca o code por token de longa duração
async function exchangeEmbeddedSignupCode(code: string): Promise<string> {
  const res = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
    params: {
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      code,
    },
  })
  return res.data.access_token
}

// Assina o app no WABA para receber mensagens via webhook (equivalente a setupMetaWebhook para páginas)
async function subscribeAppToWaba(wabaId: string, accessToken: string) {
  try {
    await axios.post(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch (err: any) {
    console.error('[META-WA-SIGNUP] Erro ao assinar app no WABA:', err?.response?.data || err?.message)
  }
}

export async function metaWhatsAppSignupRoutes(app: FastifyInstance) {
  app.post('/channels/whatsapp-meta/signup', { onRequest: [app.authenticate, requireAdmin()] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { code, wabaId, phoneNumberId } = z.object({
      code: z.string().min(1),
      wabaId: z.string().optional(),
      phoneNumberId: z.string().optional(),
    }).parse(req.body)

    if (!wabaId || !phoneNumberId) {
      return reply.status(400).send({ error: 'wabaId/phoneNumberId não recebidos do Embedded Signup — tente reconectar' })
    }

    // Reautorização do mesmo número já conectado: não conta contra o limite do plano.
    const existingChannels = await prisma.channel.findMany({ where: { candidateId, type: 'WHATSAPP' } })
    const existingChannel = existingChannels.find((c) => (c.config as any)?.phoneNumberId === phoneNumberId)

    if (!existingChannel) {
      try {
        await assertWhatsAppLimit(candidateId)
      } catch (err) {
        if (err instanceof WhatsAppLimitExceededError) {
          return reply.status(403).send({
            error: `Limite de números de WhatsApp do seu plano atingido (${err.current}/${err.limit}). Faça upgrade do plano para conectar mais números.`,
            code: 'WHATSAPP_LIMIT_EXCEEDED',
            current: err.current,
            limit: err.limit,
          })
        }
        throw err
      }
    }

    let accessToken: string
    try {
      accessToken = await exchangeEmbeddedSignupCode(code)
    } catch (err: any) {
      console.error('[META-WA-SIGNUP] Erro ao trocar code por token:', err?.response?.data || err?.message)
      return reply.status(400).send({ error: 'Não foi possível validar a conexão com a Meta' })
    }

    let displayPhoneNumber: string | undefined
    try {
      const phoneRes = await axios.get(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
        params: { access_token: accessToken, fields: 'display_phone_number,verified_name' },
      })
      displayPhoneNumber = phoneRes.data?.display_phone_number
    } catch (err: any) {
      console.error('[META-WA-SIGNUP] Erro ao buscar número:', err?.response?.data || err?.message)
    }

    const channelData = {
      name: displayPhoneNumber || 'WhatsApp (Meta)',
      config: { provider: 'meta-cloud', phoneNumberId, wabaId, accessToken, displayPhoneNumber },
    }

    const channel = existingChannel
      ? await prisma.channel.update({ where: { id: existingChannel.id }, data: channelData })
      : await prisma.channel.create({ data: { candidateId, type: 'WHATSAPP', ...channelData } })

    await subscribeAppToWaba(wabaId, accessToken)

    const provider = new MetaCloudApiProvider()
    try {
      const status = await provider.getStatus(channel.id)
      if (status !== 'connected') console.error(`[META-WA-SIGNUP] Canal ${channel.id} criado mas status não é 'connected':`, status)
    } catch (err: any) {
      console.error('[META-WA-SIGNUP] Erro ao validar status do canal recém-criado:', err?.message)
    }

    return reply.status(201).send(channel)
  })
}
