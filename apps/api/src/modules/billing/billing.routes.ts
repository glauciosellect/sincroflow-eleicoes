import type { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' as any })

const CANCELLATION_REASON = 'SUBSCRIPTION_CANCELLED'

export async function billingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/billing', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) return reply.status(404).send({ error: 'Candidato não encontrado' })
    return reply.send({
      plan: candidate.plan,
      status: candidate.status,
      whatsappLineLimit: candidate.whatsappLineLimit,
      activeMsgsIncluded: candidate.activeMsgsIncluded,
      activeMsgsUsed: candidate.activeMsgsUsed,
      activeMsgsExtra: candidate.activeMsgsExtra,
      activeMsgsResetAt: candidate.activeMsgsResetAt,
      cancellationReason: candidate.cancellationReason,
      cancellationRequestedAt: candidate.cancellationRequestedAt,
    })
  })

  app.get('/billing/invoices', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const invoices = await prisma.invoice.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(invoices)
  })

  // Ativa o "Modo Mandato" — upgrade de plano após a eleição (seção 4.11 da spec).
  // Não cria nova assinatura: o candidato eleito simplesmente não cancela, e a campanha
  // muda de fase — todo o histórico/contatos/conversas são preservados.
  app.post('/billing/upgrade-mandate', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const updated = await prisma.candidate.update({ where: { id: candidateId }, data: { plan: 'MANDATE' } })
    return reply.send(updated)
  })

  // Candidato solicita cancelamento pelo painel — assinatura continua ativa até o fim
  // do período já pago (cancel_at_period_end), depois o webhook customer.subscription.deleted
  // marca status=CANCELLED. O agente de IA é desativado imediatamente (não responde mais
  // eleitores nem dispara criativos), mas o candidato continua acessando o painel e os
  // dados por tempo indeterminado — só a função do agente para.
  app.post('/billing/cancel', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body)

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate?.stripeSubscriptionId) {
      return reply.status(400).send({ error: 'Nenhuma assinatura ativa encontrada.' })
    }

    await stripe.subscriptions.update(candidate.stripeSubscriptionId, { cancel_at_period_end: true })

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { cancellationReason: reason, cancellationRequestedAt: new Date() },
    })

    await prisma.agentConfig.updateMany({
      where: { candidateId, isActive: true },
      data: { isActive: false, deactivatedAt: new Date(), deactivationReason: CANCELLATION_REASON },
    })

    return reply.send({ ok: true, message: 'Cancelamento solicitado. Sua assinatura permanece ativa até o fim do período já pago.' })
  })

  // Desfaz uma solicitação de cancelamento ainda não efetivada (a assinatura no Stripe
  // ainda existe, só estava marcada para não renovar) e reativa o agente.
  app.post('/billing/reactivate', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate?.stripeSubscriptionId) {
      return reply.status(400).send({ error: 'Nenhuma assinatura encontrada.' })
    }
    if (candidate.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Assinatura já encerrada — assine novamente para continuar.' })
    }

    await stripe.subscriptions.update(candidate.stripeSubscriptionId, { cancel_at_period_end: false })

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { cancellationReason: null, cancellationRequestedAt: null },
    })

    await prisma.agentConfig.updateMany({
      where: { candidateId, deactivationReason: CANCELLATION_REASON },
      data: { isActive: true, deactivatedAt: null, deactivationReason: null },
    })

    return reply.send({ ok: true, message: 'Cancelamento desfeito — seu assistente foi reativado.' })
  })
}
