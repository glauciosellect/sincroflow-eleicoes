import type { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { getPendingRegistration, activatePendingRegistration } from '../auth/auth.service'
import { TERMS_VERSION, TERMS_TEXT } from './terms-content'

// apiVersion forçada explicitamente: o SDK não atualiza isso automaticamente,
// e branding_settings (nome customizado por sessão de checkout) só funciona em
// versões de API a partir de 2025-09-30 — sem isso o campo é ignorado silenciosamente.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' as any })

// TODO: substituir pelos Price IDs reais criados no Stripe do SyncroFlowEleições
const PLAN_PRICE_IDS: Record<'CAMPAIGN' | 'MANDATE', string | undefined> = {
  CAMPAIGN: process.env.STRIPE_PRICE_CAMPAIGN,
  MANDATE: process.env.STRIPE_PRICE_MANDATE,
}

// Recarga avulsa de mensagens ativas — comprada quando o limite do plano se esgota
export const ACTIVE_MSG_RECHARGE = { amount: 1000, priceId: process.env.STRIPE_PRICE_RECHARGE_1000 }

// Linha extra de WhatsApp — assinatura recorrente, adicionada como item na subscription
// principal do candidato (não é um checkout novo, é quantity num price já existente).
const WHATSAPP_LINE_PRICE_ID = process.env.STRIPE_PRICE_WHATSAPP_LINE

// Recalcula whatsappLineLimit a partir do que está de fato cobrado na subscription do
// Stripe (1 linha base do plano + soma das quantities do price de linha extra) — evita
// que incrementos manuais desalinhem do que está realmente sendo cobrado.
async function syncWhatsAppLineLimit(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items'] })
  const extraLines = subscription.items.data
    .filter((item) => item.price.id === WHATSAPP_LINE_PRICE_ID)
    .reduce((sum, item) => sum + (item.quantity || 0), 0)

  const candidate = await prisma.candidate.findFirst({ where: { stripeSubscriptionId: subscriptionId } })
  if (!candidate) return
  await prisma.candidate.update({ where: { id: candidate.id }, data: { whatsappLineLimit: 1 + extraLines } })
}

export async function stripeRoutes(app: FastifyInstance) {

  // Retorna o texto vigente do Termo de Aceite
  app.get('/billing/terms', async (req, reply) => {
    return reply.send({ version: TERMS_VERSION, text: TERMS_TEXT })
  })

  // ── Passo 2 do registro: checkout do plano de campanha ──────────────────
  // O candidato já preencheu o Passo 1 (/auth/register) e recebeu um pendingId.
  // Este endpoint cria a sessão de pagamento; a conta só é criada de fato
  // quando o webhook confirmar o pagamento (checkout.session.completed).
  app.post('/auth/register/checkout', async (req, reply) => {
    const { pendingId, plan = 'CAMPAIGN' } = req.body as { pendingId: string; plan?: 'CAMPAIGN' | 'MANDATE' }
    const pending = await getPendingRegistration(pendingId)
    if (!pending) return reply.status(400).send({ error: 'Cadastro expirado ou inválido. Recomece o registro.' })

    const priceId = PLAN_PRICE_IDS[plan]
    if (!priceId) return reply.status(500).send({ error: 'Plano não configurado. Contate o suporte.' })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: pending.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { type: 'registration', pendingId, plan },
      subscription_data: { metadata: { type: 'registration', pendingId, plan } },
      success_url: `${process.env.FRONTEND_URL}/login?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/register?payment=cancelled`,
      branding_settings: { display_name: 'SyncroFlowEleições' } as any,
    })

    return reply.send({ url: session.url })
  })

  // Recarga avulsa de mensagens ativas (candidato já com conta ativa)
  app.post('/billing/checkout-active-msgs', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    if (!ACTIVE_MSG_RECHARGE.priceId) return reply.status(500).send({ error: 'Recarga não configurada. Contate o suporte.' })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price: ACTIVE_MSG_RECHARGE.priceId, quantity: 1 }],
      metadata: { type: 'active_msgs', candidateId, amount: String(ACTIVE_MSG_RECHARGE.amount) },
      success_url: `${process.env.FRONTEND_URL}/configuracoes?tab=billing&payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/configuracoes?tab=billing&payment=cancelled`,
      branding_settings: { display_name: 'SyncroFlowEleições' } as any,
    })

    return reply.send({ url: session.url })
  })

  // Adiciona N linhas extras de WhatsApp à assinatura já ativa do candidato (recorrente,
  // R$ 497/mês cada). O limite (whatsappLineLimit) só sobe quando o webhook confirmar.
  app.post('/billing/whatsapp-lines', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    if (!WHATSAPP_LINE_PRICE_ID) return reply.status(500).send({ error: 'Recarga de WhatsApp não configurada. Contate o suporte.' })

    const { quantity } = z.object({ quantity: z.number().int().min(1).max(30) }).parse(req.body)

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate?.stripeSubscriptionId) {
      return reply.status(400).send({ error: 'Assine o plano antes de adicionar linhas de WhatsApp.' })
    }

    const subscription = await stripe.subscriptions.retrieve(candidate.stripeSubscriptionId, { expand: ['items'] })
    const existingItem = subscription.items.data.find((item) => item.price.id === WHATSAPP_LINE_PRICE_ID)

    if (existingItem) {
      await stripe.subscriptionItems.update(existingItem.id, { quantity: (existingItem.quantity || 0) + quantity })
    } else {
      await stripe.subscriptionItems.create({
        subscription: candidate.stripeSubscriptionId,
        price: WHATSAPP_LINE_PRICE_ID,
        quantity,
      })
    }

    return reply.send({ ok: true, message: 'Linhas adicionadas — disponíveis após confirmação do pagamento.' })
  })

  // Registra o aceite do Termo pelo usuário autenticado, para efeitos legais
  app.post('/billing/terms/accept', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const acceptance = await prisma.termsAcceptance.create({
      data: {
        candidateId,
        userId: sub,
        version: TERMS_VERSION,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    })

    return reply.send({ id: acceptance.id, acceptedAt: acceptance.acceptedAt })
  })

  // Portal de gerenciamento (cancelar, trocar cartão, ver faturas)
  app.post('/billing/portal', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate?.stripeCustomerId) {
      return reply.status(400).send({ error: 'Nenhuma assinatura encontrada.' })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: candidate.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/configuracoes?tab=billing`,
    })

    return reply.send({ url: portalSession.url })
  })

  // Webhook do Stripe — processa todos os eventos relevantes
  app.post('/billing/webhook', { config: { rawBody: true } }, async (req, reply) => {
    const sig = req.headers['stripe-signature'] as string
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    let event: any
    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(
          (req as any).rawBody || Buffer.from(JSON.stringify(req.body)),
          sig,
          webhookSecret,
        )
      } else {
        event = req.body as any
      }
    } catch (err: any) {
      return reply.status(400).send({ error: `Webhook error: ${err.message}` })
    }

    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as any
        const meta = session.metadata || {}

        // Pagamento do registro aprovado → cria a conta de fato
        if (meta.type === 'registration' && meta.pendingId) {
          const result = await activatePendingRegistration(
            meta.pendingId,
            session.customer as string,
            session.subscription as string,
          )
          if (!result) console.error('[STRIPE] Falha ao ativar registro pendente:', meta.pendingId)
          break
        }

        // Recarga avulsa de mensagens ativas paga
        if (meta.type === 'active_msgs' && meta.candidateId && meta.amount) {
          await prisma.candidate.update({
            where: { id: meta.candidateId },
            data: { activeMsgsExtra: { increment: parseInt(meta.amount) } },
          })
          await prisma.invoice.create({
            data: { candidateId: meta.candidateId, amount: session.amount_total || 0, status: 'paid', externalId: session.id },
          })
        }
        break
      }

      // ── Fatura paga (renovação do ciclo) — zera o uso de mensagens ativas ──
      case 'invoice.paid': {
        const invoice = event.data.object as any
        const subscriptionId = invoice.subscription as string
        if (!subscriptionId) break

        const candidate = await prisma.candidate.findFirst({ where: { stripeSubscriptionId: subscriptionId } })
        if (!candidate) break

        await prisma.candidate.update({
          where: { id: candidate.id },
          data: { status: 'ACTIVE', activeMsgsUsed: 0, activeMsgsExtra: 0, activeMsgsResetAt: new Date() },
        })

        await prisma.invoice.create({
          data: { candidateId: candidate.id, amount: invoice.amount_paid || 0, status: 'paid', externalId: invoice.id },
        })

        await syncWhatsAppLineLimit(subscriptionId)
        break
      }

      // ── Pagamento falhou ─────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const subscriptionId = invoice.subscription as string
        if (!subscriptionId) break

        const candidate = await prisma.candidate.findFirst({ where: { stripeSubscriptionId: subscriptionId } })
        if (!candidate) break

        await prisma.invoice.create({
          data: { candidateId: candidate.id, amount: invoice.amount_due || 0, status: 'failed', externalId: invoice.id },
        })
        break
      }

      // ── Assinatura alterada (ex: linha de WhatsApp removida pelo Portal) ───
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        await syncWhatsAppLineLimit(subscription.id)
        break
      }

      // ── Assinatura cancelada ──────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        const candidate = await prisma.candidate.findFirst({ where: { stripeSubscriptionId: subscription.id } })
        if (!candidate) break

        await prisma.candidate.update({ where: { id: candidate.id }, data: { status: 'CANCELLED' } })
        break
      }
    }

    return reply.send({ received: true })
  })
}
