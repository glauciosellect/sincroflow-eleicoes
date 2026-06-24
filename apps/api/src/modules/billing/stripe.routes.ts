import type { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { getPendingRegistration, activatePendingRegistration } from '../auth/auth.service'
import { TERMS_VERSION, TERMS_TEXT } from './terms-content'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// TODO: substituir pelos Price IDs reais criados no Stripe do SyncroFlowEleições
const PLAN_PRICE_IDS: Record<'CAMPAIGN' | 'MANDATE', string | undefined> = {
  CAMPAIGN: process.env.STRIPE_PRICE_CAMPAIGN,
  MANDATE: process.env.STRIPE_PRICE_MANDATE,
}

// Recarga avulsa de mensagens ativas — comprada quando o limite do plano se esgota
export const ACTIVE_MSG_RECHARGE = { amount: 1000, priceId: process.env.STRIPE_PRICE_RECHARGE_1000 }

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
    })

    return reply.send({ url: session.url })
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
