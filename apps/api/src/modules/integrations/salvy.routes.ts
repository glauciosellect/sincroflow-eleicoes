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

// Adiciona o número à WABA (passo 1 do fluxo oficial da Meta) — sem código de
// verificação ainda, é só o cadastro do número. Retorna o phoneNumberId, necessário
// para os passos seguintes (request_code, verify_code, register).
async function addPhoneNumberToWaba(systemToken: string, wabaId: string, phoneNumber: string): Promise<string> {
  const res = await axios.post(
    `${GRAPH_URL}/${wabaId}/phone_numbers`,
    { phone_number: phoneNumber, cc: '55', verified_name: 'SyncroFlowEleições' },
    { headers: { Authorization: `Bearer ${systemToken}` } },
  )
  return res.data.id
}

// Passo 2: solicita o envio do código de verificação (SMS ou ligação) para o número
// recém-adicionado — é essa chamada que efetivamente dispara o SMS que a Salvy repassa
// pelo webhook. Reutilizada também para reenviar o código, se o candidato pedir de novo.
async function requestVerificationCode(accessToken: string, phoneNumberId: string, method: 'SMS' | 'VOICE' = 'SMS'): Promise<void> {
  await axios.post(
    `${GRAPH_URL}/${phoneNumberId}/request_code`,
    { code_method: method, language: 'pt_BR' },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
}

// Passo 3: confirma o código de verificação recebido por SMS.
async function verifyPhoneCode(accessToken: string, phoneNumberId: string, code: string): Promise<void> {
  await axios.post(
    `${GRAPH_URL}/${phoneNumberId}/verify_code`,
    { code },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
}

// Passo 4: registra o número para uso efetivo na Cloud API (envio/recebimento de
// mensagens) — sem essa chamada o número fica preso em "verificado mas não registrado".
// O PIN é interno (nunca digitado por ninguém), usado só internamente pela Meta para
// a verificação em duas etapas da linha.
async function registerPhoneForMessaging(accessToken: string, phoneNumberId: string): Promise<void> {
  const pin = String(Math.floor(100000 + Math.random() * 900000))
  await axios.post(
    `${GRAPH_URL}/${phoneNumberId}/register`,
    { messaging_product: 'whatsapp', pin },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
}

// Executa o fluxo oficial completo de registro na WABA da SyncroFlow, a partir do
// código de verificação já recebido via webhook da Salvy (passos 3 e 4 — os passos 1 e
// 2, adicionar número e pedir o código, já rodaram antes, ver acquireAndRequestCode).
// Retorna phoneNumberId e accessToken que ficam em Channel.config.
async function completeWabaRegistration(phoneNumberId: string, verificationCode: string): Promise<{
  phoneNumberId: string
  accessToken: string
  wabaId: string
}> {
  const tokenRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, grant_type: 'client_credentials' },
  })
  const systemToken: string = tokenRes.data.access_token
  const wabaId = process.env.META_WABA_ID!

  await verifyPhoneCode(systemToken, phoneNumberId, verificationCode)
  await registerPhoneForMessaging(systemToken, phoneNumberId)

  return { phoneNumberId, accessToken: systemToken, wabaId }
}

// Passos 1 e 2 do fluxo oficial — chamado assim que o candidato adquire o número na
// Salvy (antes de qualquer código existir), para já disparar o SMS de verificação.
async function acquireAndRequestCode(phoneNumber: string): Promise<{ phoneNumberId: string }> {
  const tokenRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, grant_type: 'client_credentials' },
  })
  const systemToken: string = tokenRes.data.access_token
  const wabaId = process.env.META_WABA_ID!

  const phoneNumberId = await addPhoneNumberToWaba(systemToken, wabaId, phoneNumber)
  await requestVerificationCode(systemToken, phoneNumberId, 'SMS')

  return { phoneNumberId }
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Confirma o código (verify_code) e finaliza o registro (register) — ativa o canal
// automaticamente assim que o SMS chega via webhook (ver POST /webhooks/salvy), sem
// esperar o candidato clicar em nada. Recomendação da própria Salvy: "finalize a
// verificação automaticamente na API do provedor" no backend, ao receber o OTP.
// O phoneNumberId é preenchido em background por acquireAndRequestCode logo após a
// compra do número (passos 1 e 2) — se o webhook do SMS chegar antes disso terminar,
// espera um pouco e tenta de novo (poucas vezes, com backoff curto).
async function activateChannelWithCode(channelId: string, verificationCode: string): Promise<void> {
  let channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel) return
  if (channel.isActive) return

  let config = channel.config as any
  for (let attempt = 0; !config?.phoneNumberId && attempt < 5; attempt++) {
    await sleep(2000)
    channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel || channel.isActive) return
    config = channel.config as any
  }

  const phoneNumberId = config?.phoneNumberId
  if (!phoneNumberId) {
    logger.error('[SALVY] Auto-ativação abortada: phoneNumberId não disponível a tempo', { channelId })
    return
  }

  let wabaData: { phoneNumberId: string; accessToken: string; wabaId: string }
  try {
    wabaData = await completeWabaRegistration(phoneNumberId, verificationCode)
  } catch (err: any) {
    logger.error('[SALVY] Auto-ativação: erro ao confirmar/registrar número na WABA', { channelId, error: err?.response?.data || err?.message })
    return
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      isActive: true,
      externalId: wabaData.phoneNumberId,
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
  logger.info('[SALVY] Canal ativado automaticamente via webhook', { channelId })
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
          // phoneNumberId é preenchido assim que o número é aceito na WABA (ver
          // background abaixo); accessToken só após verify_code confirmar o SMS.
          phoneNumberId: null,
          accessToken: null,
          wabaId: null,
          verificationCode: null,
        },
      },
    })

    // Passos 1 e 2 do fluxo oficial (adicionar número + pedir SMS) em background —
    // não bloqueia a resposta ao candidato. A linha recém-comprada na Salvy pode levar
    // alguns segundos para ficar apta na rede; tenta algumas vezes com backoff antes de
    // desistir e marcar registrationError, que a UI exibe como erro visível ao candidato.
    ;(async () => {
      const delaysMs = [0, 5000, 15000]
      for (let i = 0; i < delaysMs.length; i++) {
        if (delaysMs[i] > 0) await sleep(delaysMs[i])
        try {
          const { phoneNumberId } = await acquireAndRequestCode(account.phoneNumber)
          await prisma.channel.update({
            where: { id: channel.id },
            data: { config: { ...(channel.config as any), phoneNumberId } },
          })
          return
        } catch (err: any) {
          logger.warn('[SALVY] Tentativa de adicionar número/solicitar código falhou', { channelId: channel.id, attempt: i, error: err?.response?.data || err?.message })
        }
      }
      logger.error('[SALVY] Todas as tentativas de adicionar número/solicitar código falharam', { channelId: channel.id })
      await prisma.channel.update({
        where: { id: channel.id },
        data: { config: { ...(channel.config as any), registrationError: true } },
      }).catch(() => {})
    })()

    return reply.status(201).send({ channel, salvyAccount: account })
  })

  // Após receber o código SMS (via webhook abaixo), o candidato confirma no painel
  // para finalizar o registro do número na WABA e ativar o canal — fallback manual,
  // já que activateChannelWithCode normalmente já faz isso sozinho via webhook.
  app.post('/integrations/salvy/virtual-numbers/:channelId/activate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { channelId } = z.object({ channelId: z.string() }).parse(req.params)
    const { verificationCode } = z.object({ verificationCode: z.string().min(1) }).parse(req.body)

    const channel = await prisma.channel.findFirst({ where: { id: channelId, candidateId } })
    if (!channel) return reply.status(404).send({ error: 'Canal não encontrado' })

    const config = channel.config as any
    if (channel.isActive) return reply.status(400).send({ error: 'Canal já está ativo' })

    const phoneNumberId = config?.phoneNumberId
    if (!phoneNumberId) return reply.status(400).send({ error: 'Número ainda não foi preparado na Meta. Aguarde alguns segundos e tente novamente.' })

    let wabaData: { phoneNumberId: string; accessToken: string; wabaId: string }
    try {
      wabaData = await completeWabaRegistration(phoneNumberId, verificationCode)
    } catch (err: any) {
      logger.error('[SALVY] Erro ao registrar número na WABA:', err?.response?.data || err?.message)
      return reply.status(400).send({ error: 'Código de verificação inválido ou expirado. Tente solicitar um novo SMS.' })
    }

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: {
        isActive: true,
        externalId: wabaData.phoneNumberId,
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

  // Candidato pede um novo SMS (ex: o primeiro não chegou ou expirou) — reutiliza o
  // mesmo request_code da Meta, sem depender do dono da conta Salvy para nada.
  app.post('/integrations/salvy/virtual-numbers/:channelId/resend-code', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { channelId } = z.object({ channelId: z.string() }).parse(req.params)
    const { method } = z.object({ method: z.enum(['SMS', 'VOICE']).default('SMS') }).parse(req.body ?? {})

    const channel = await prisma.channel.findFirst({ where: { id: channelId, candidateId } })
    if (!channel) return reply.status(404).send({ error: 'Canal não encontrado' })
    if (channel.isActive) return reply.status(400).send({ error: 'Canal já está ativo' })

    const config = channel.config as any
    const phoneNumberId = config?.phoneNumberId
    if (!phoneNumberId) return reply.status(400).send({ error: 'Número ainda não foi preparado na Meta. Aguarde alguns segundos e tente novamente.' })

    try {
      const tokenRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
        params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, grant_type: 'client_credentials' },
      })
      await requestVerificationCode(tokenRes.data.access_token, phoneNumberId, method)
    } catch (err: any) {
      logger.error('[SALVY] Erro ao reenviar código de verificação:', err?.response?.data || err?.message)
      return reply.status(400).send({ error: 'Não foi possível reenviar o código agora. Tente novamente em instantes.' })
    }

    return reply.send({ ok: true })
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

  // Webhook da Salvy (assinado via Svix) — recebe sms.received com o código de verificação
  // do WhatsApp. Ao receber o código, ativa o canal automaticamente (registra o número
  // na WABA da Meta) — sem esperar o candidato clicar em nada, conforme orientação da
  // própria Salvy ("finalize a verificação automaticamente na API do provedor").
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

          await activateChannelWithCode(channel.id, verificationCode)
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
      phoneNumberId: config?.phoneNumberId ?? null,
      registrationError: !!config?.registrationError,
    })
  })
}
