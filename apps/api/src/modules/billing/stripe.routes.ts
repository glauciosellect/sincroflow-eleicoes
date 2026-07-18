import type { FastifyInstance } from 'fastify'
import { logger } from '../../lib/logger'
import Stripe from 'stripe'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { getPendingRegistration, createCandidateAccount, activateCampaignPayment, updatePendingRegistrationPayment } from '../auth/auth.service'
import { TERMS_VERSION, TERMS_TEXT } from './terms-content'
import { requireAdmin } from '../../lib/rbac'

// apiVersion forçada explicitamente: o SDK não atualiza isso automaticamente,
// e branding_settings (nome customizado por sessão de checkout) só funciona em
// versões de API a partir de 2025-09-30 — sem isso o campo é ignorado silenciosamente.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' as any })

// Identidade visual do checkout — mesma logo e cores usadas na landing page.
const CHECKOUT_BRANDING = {
  display_name: 'SyncroFlowEleições',
  button_color: '#009C3B',
  border_style: 'rounded',
  icon: { type: 'url', url: 'https://syncrofloweleicoes.com.br/logo.png' },
  logo: { type: 'url', url: 'https://syncrofloweleicoes.com.br/logo.png' },
} as const

// Price IDs por cargo — pagamento único para todo o período eleitoral (eleições 2026).
// Criar no Stripe Dashboard: 3 produtos (um por cargo), cada um com 1 price avulso (mode: payment).
// STRIPE_PRICE_DEP_ESTADUAL → R$ 5.990 (599000 centavos)
// STRIPE_PRICE_DEP_FEDERAL  → R$ 7.490 (749000 centavos)
// STRIPE_PRICE_SENADOR_GOV  → R$ 10.990 (1099000 centavos)
// STRIPE_PRICE_MANDATE      → plano mandato (oculto até após eleições)
const CARGO_PRICE_IDS: Record<string, string | undefined> = {
  DEP_ESTADUAL: process.env.STRIPE_PRICE_DEP_ESTADUAL,
  DEP_FEDERAL:  process.env.STRIPE_PRICE_DEP_FEDERAL,
  SENADOR_GOV:  process.env.STRIPE_PRICE_SENADOR_GOV,
  MANDATE:      process.env.STRIPE_PRICE_MANDATE,
}

// Valores totais por cargo em centavos — mesmos valores exibidos no site/Asaas (fonte
// única de preço, ver Módulo 8 da SPEC-Escala-Webhooks) — usados para exibição e metadata do Stripe.
export const CARGO_PRICES: Record<string, { label: string; total: number }> = {
  DEP_ESTADUAL: { label: 'Deputado(a) Estadual',       total: 599000  },
  DEP_FEDERAL:  { label: 'Deputado(a) Federal',         total: 749000  },
  SENADOR_GOV:  { label: 'Senador(a) / Governador(a)', total: 1099000 },
}

// Recarga avulsa de mensagens ativas — comprada quando o limite do plano se esgota
export const ACTIVE_MSG_RECHARGE = { amount: 1000, priceId: process.env.STRIPE_PRICE_RECHARGE_1000 }

// Pagamento único para toda a campanha — sem expiração por período
const CAMPAIGN_PAYMENT_VALIDITY_DAYS = 9999

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
  // + whatsappLinesManual: linhas aprovadas manualmente no painel /admin (Pix direto,
  // fora do Stripe) — sem essa soma, esse webhook sobrescreveria e perderia essas
  // linhas a cada renovação de cartão.
  await prisma.candidate.update({ where: { id: candidate.id }, data: { whatsappLineLimit: 1 + extraLines + candidate.whatsappLinesManual } })
}

export async function stripeRoutes(app: FastifyInstance) {

  // Retorna o texto vigente do Termo de Aceite
  app.get('/billing/terms', async (req, reply) => {
    return reply.send({ version: TERMS_VERSION, text: TERMS_TEXT })
  })

  // ── Passo 2 do registro: cria a conta e inicia checkout por cargo ─────────
  // Módulo 8 (SPEC-Escala-Webhooks): a conta (User + Candidate ACTIVE) é criada AQUI,
  // antes do pagamento — o candidato já pode logar e usar o sistema imediatamente.
  // O pagamento (Stripe) só libera os módulos que dependem de "Ativação da Campanha"
  // (ver lib/rbac.ts + lib/campaign-activation.ts). O webhook, ao confirmar o
  // pagamento, chama activateCampaignPayment — não cria mais a conta.
  //
  // cargo: DEP_ESTADUAL | DEP_FEDERAL | SENADOR_GOV (eleições 2026)
  // paymentMethod: pix (à vista) | card (1x, 2x ou 3x sem juros)
  // installments: 1 | 2 | 3 — só para cartão; ignorado para pix
  app.post('/auth/register/checkout', async (req, reply) => {
    const { pendingId, cargo = 'DEP_ESTADUAL', paymentMethod = 'card', installments = 1 } = req.body as {
      pendingId: string
      cargo?: string
      paymentMethod?: 'card' | 'pix'
      installments?: 1 | 2 | 3
    }

    const pending = await getPendingRegistration(pendingId)
    if (!pending) return reply.status(400).send({ error: 'Cadastro expirado ou inválido. Recomece o registro.' })

    if (!CARGO_PRICE_IDS[cargo]) {
      return reply.status(400).send({ error: 'Cargo inválido.' })
    }

    const priceId = CARGO_PRICE_IDS[cargo]
    if (!priceId) return reply.status(500).send({ error: `Preço para ${cargo} não configurado. Contate o suporte.` })

    await updatePendingRegistrationPayment(pendingId, paymentMethod as any, 'CAMPAIGN')

    const account = await createCandidateAccount(pendingId, cargo)
    if (!account) return reply.status(400).send({ error: 'Não foi possível criar a conta. Tente novamente ou contate o suporte.' })

    const validInstallments = paymentMethod === 'card' ? Math.min(3, Math.max(1, installments)) : 1

    const sessionParams: any = {
      payment_method_types: [paymentMethod],
      mode: 'payment',
      customer_email: pending.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { type: 'campaign_activation', candidateId: account.candidateId, cargo, paymentMethod },
      success_url: `${process.env.FRONTEND_URL}/login?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/login?payment=cancelled`,
      branding_settings: CHECKOUT_BRANDING as any,
    }

    // Parcelamento sem juros via Stripe: disponível apenas para cartão brasileiro.
    // O Stripe oferece isso via payment_method_options.card.installments.
    if (paymentMethod === 'card' && validInstallments > 1) {
      sessionParams.payment_method_options = {
        card: {
          installments: { enabled: true },
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    const tokens = {
      accessToken: app.jwt.sign({ sub: account.userId, wid: account.candidateId, role: 'ADMINISTRADOR' }, { expiresIn: '15m' }),
      refreshToken: app.jwt.sign({ sub: account.userId, type: 'refresh' }, { expiresIn: '7d' }),
    }
    const { saveRefreshToken } = await import('../auth/auth.service')
    await saveRefreshToken(account.userId, tokens.refreshToken)

    const [user, candidate] = await Promise.all([
      prisma.user.findUnique({ where: { id: account.userId } }),
      prisma.candidate.findUnique({ where: { id: account.candidateId } }),
    ])
    const { passwordHash, twoFactorSecret, ...safeUser } = user!

    return reply.send({ url: session.url, user: safeUser, candidate, role: 'ADMINISTRADOR', ...tokens })
  })

  // Recarga avulsa de mensagens ativas (candidato já com conta ativa) — quantity é o
  // número de pacotes de 1.000 mensagens (cada pacote = 1 unidade do price no Stripe).
  app.post('/billing/checkout-active-msgs', { onRequest: [app.authenticate, requireAdmin()] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { quantity, paymentMethod } = z.object({
      quantity: z.number().int().min(1).max(20).default(1),
      paymentMethod: z.enum(['card', 'pix', 'boleto']).default('card'),
    }).parse(req.body || {})

    if (!ACTIVE_MSG_RECHARGE.priceId) return reply.status(500).send({ error: 'Recarga não configurada. Contate o suporte.' })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: [paymentMethod],
      mode: 'payment',
      line_items: [{ price: ACTIVE_MSG_RECHARGE.priceId, quantity }],
      metadata: { type: 'active_msgs', candidateId, amount: String(ACTIVE_MSG_RECHARGE.amount * quantity) },
      success_url: `${process.env.FRONTEND_URL}/configuracoes?tab=billing&payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/configuracoes?tab=billing&payment=cancelled`,
      branding_settings: CHECKOUT_BRANDING as any,
    })

    return reply.send({ url: session.url })
  })

  // "Comprar Créditos de IA com linha Virtual para Whatsapp" (Módulo 8, item 7) — checkout
  // avulso (mode: payment), consistente com o pagamento único da campanha. O limite
  // (whatsappLineLimit/whatsappLinesManual) só sobe quando o webhook confirmar o pagamento.
  app.post('/billing/whatsapp-lines', { onRequest: [app.authenticate, requireAdmin()] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    if (!WHATSAPP_LINE_PRICE_ID) return reply.status(500).send({ error: 'Créditos de linha WhatsApp não configurados. Contate o suporte.' })

    const { quantity } = z.object({ quantity: z.number().int().min(1).max(30) }).parse(req.body)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price: WHATSAPP_LINE_PRICE_ID, quantity }],
      metadata: { type: 'whatsapp_line_credit', candidateId, quantity: String(quantity) },
      success_url: `${process.env.FRONTEND_URL}/settings?tab=billing&payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/settings?tab=billing&payment=cancelled`,
      branding_settings: CHECKOUT_BRANDING as any,
    })

    return reply.send({ url: session.url })
  })

  // "Ativação da Campanha" para conta já existente (candidato logado sem campanha paga
  // ainda) — checkout avulso vinculado ao candidateId (não a um pendingId de registro).
  // Módulo 8: complementa o fluxo de registro, que já cria a conta e ativa via
  // 'registration_onetime' no mesmo webhook.
  app.post('/billing/activate-campaign', { onRequest: [app.authenticate, requireAdmin()] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { cargo, paymentMethod = 'card', installments = 1 } = z.object({
      cargo: z.enum(['DEP_ESTADUAL', 'DEP_FEDERAL', 'SENADOR_GOV']),
      paymentMethod: z.enum(['card', 'pix']).default('card'),
      installments: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
    }).parse(req.body)

    const priceId = CARGO_PRICE_IDS[cargo]
    if (!priceId) return reply.status(500).send({ error: `Preço para ${cargo} não configurado. Contate o suporte.` })

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) return reply.status(404).send({ error: 'Candidato não encontrado' })

    const validInstallments = paymentMethod === 'card' ? Math.min(3, Math.max(1, installments)) : 1

    const sessionParams: any = {
      payment_method_types: [paymentMethod],
      mode: 'payment',
      customer_email: candidate.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { type: 'campaign_activation', candidateId, cargo, paymentMethod },
      success_url: `${process.env.FRONTEND_URL}/settings?tab=billing&payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/settings?tab=billing&payment=cancelled`,
      branding_settings: CHECKOUT_BRANDING as any,
    }

    if (paymentMethod === 'card' && validInstallments > 1) {
      sessionParams.payment_method_options = { card: { installments: { enabled: true } } }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
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

        // Pagamento do registro aprovado → cria a conta de fato (fluxo Stripe legado,
        // não usado pelo frontend atual — mantido só para não quebrar compilação/histórico)
        if (meta.type === 'registration' && meta.pendingId) {
          const result = await createCandidateAccount(meta.pendingId)
          if (result) {
            await prisma.candidate.update({
              where: { id: result.candidateId },
              data: { stripeCustomerId: session.customer as string, stripeSubscriptionId: session.subscription as string },
            })
          } else {
            logger.error('[STRIPE] Falha ao criar conta do registro pendente:', meta.pendingId)
          }
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

        // Módulo 8, item 7: créditos de linha WhatsApp confirmados — soma ao limite manual.
        if (meta.type === 'whatsapp_line_credit' && meta.candidateId && meta.quantity) {
          const quantity = parseInt(meta.quantity, 10) || 1
          await prisma.candidate.update({
            where: { id: meta.candidateId },
            data: { whatsappLinesManual: { increment: quantity }, whatsappLineLimit: { increment: quantity } },
          })
          await prisma.invoice.create({
            data: { candidateId: meta.candidateId, amount: session.amount_total || 0, status: 'paid', externalId: session.id },
          })
          break
        }

        // Ativação da Campanha de conta já existente (candidato logado, sem pagamento ainda).
        if (meta.type === 'campaign_activation' && meta.candidateId) {
          const paidUntil = new Date(Date.now() + CAMPAIGN_PAYMENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
          await prisma.candidate.update({ where: { id: meta.candidateId }, data: { stripeCustomerId: session.customer as string, ...(meta.cargo ? { position: meta.cargo } : {}) } })
          await activateCampaignPayment(meta.candidateId, { method: meta.paymentMethod || 'card', paidUntil })
          await prisma.invoice.create({
            data: { candidateId: meta.candidateId, amount: session.amount_total || 0, status: 'paid', externalId: session.id },
          })
          break
        }

        // Renovação manual mensal via Pix/boleto aprovada — reativa o candidato e o
        // agente, caso tenham sido suspensos por vencimento anterior
        // (CAMPAIGN_PAYMENT_EXPIRED, ver campaign-payment.worker.ts).
        if (meta.type === 'campaign_subscription_payment' && meta.candidateId) {
          const paidUntil = new Date(Date.now() + CAMPAIGN_PAYMENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
          await prisma.candidate.update({
            where: { id: meta.candidateId },
            data: { status: 'ACTIVE', campaignPaymentMethod: meta.paymentMethod, campaignPaidUntil: paidUntil },
          })
          await prisma.agentConfig.updateMany({
            where: { candidateId: meta.candidateId, deactivationReason: 'CAMPAIGN_PAYMENT_EXPIRED' },
            data: { isActive: true, deactivationReason: null },
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
