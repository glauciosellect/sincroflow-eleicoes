import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireAdmin } from '../../lib/rbac'
import {
  asaas, PLANOS_CAMPANHA, PlanoCampanhaKey,
  upsertClienteAsaas, criarCobrancaAsaas, getPixQrCode,
} from '../../lib/asaas'
import { logger } from '../../lib/logger'

const checkoutSchema = z.object({
  plano: z.enum(['deputado_estadual', 'deputado_federal', 'senador_governador']),
  formaPagamento: z.enum(['pix', 'cartao']),
  parcelas: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
})

export async function asaasRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // POST /billing/asaas/checkout — gera cobrança Asaas
  app.post('/billing/asaas/checkout', { onRequest: [requireAdmin()] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { plano, formaPagamento, parcelas } = checkoutSchema.parse(req.body)

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) return reply.status(404).send({ error: 'Candidato não encontrado' })

    const planoDados = PLANOS_CAMPANHA[plano as PlanoCampanhaKey]
    const billingType = formaPagamento === 'pix' ? 'PIX' : 'CREDIT_CARD'
    const parcelasNum = formaPagamento === 'pix' ? 1 : parcelas

    // Cria/recupera cliente no Asaas
    let asaasCustomerId = (candidate as any).asaasCustomerId as string | null
    if (!asaasCustomerId) {
      asaasCustomerId = await upsertClienteAsaas({
        name: candidate.name,
        cpf: candidate.cpf,
        email: candidate.email,
        whatsapp: candidate.whatsapp,
      })
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { asaasCustomerId } as any,
      })
    }

    // Cria cobrança
    const cobranca = await criarCobrancaAsaas({
      customerId: asaasCustomerId,
      valor: planoDados.valor,
      parcelas: parcelasNum as 1 | 2 | 3,
      billingType,
      descricao: planoDados.nome,
      externalReference: candidateId,
    })

    // Salva referência da cobrança no banco
    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        asaasPaymentId: cobranca.id,
        asaasPlano: plano,
      } as any,
    })

    // Registra na tabela de invoices
    await prisma.invoice.create({
      data: {
        candidateId,
        amount: Math.round(planoDados.valor * 100),
        status: 'pending',
        provider: 'asaas',
        externalId: cobranca.id,
        description: planoDados.nome,
        installments: parcelasNum,
      } as any,
    })

    // Para Pix: retorna QR Code
    if (billingType === 'PIX') {
      const qr = await getPixQrCode(cobranca.id)
      return reply.send({
        type: 'pix',
        paymentId: cobranca.id,
        qrCodeImage: qr?.encodedImage ?? null,
        qrCodePayload: qr?.payload ?? null,
        invoiceUrl: cobranca.invoiceUrl ?? null,
      })
    }

    // Para cartão: retorna link de pagamento hospedado pelo Asaas
    return reply.send({
      type: 'card',
      paymentId: cobranca.id,
      invoiceUrl: cobranca.invoiceUrl,
      installments: parcelasNum,
      installmentValue: Math.round((planoDados.valor / parcelasNum) * 100) / 100,
    })
  })

  // GET /billing/asaas/status/:paymentId — consulta status de um pagamento
  app.get('/billing/asaas/status/:paymentId', { onRequest: [requireAdmin()] }, async (req, reply) => {
    const { paymentId } = req.params as { paymentId: string }
    const res = await asaas.get(`/payments/${paymentId}`)
    return reply.send({ status: res.data.status })
  })
}

// Rotas públicas do Asaas (sem auth JWT) — status de pagamento para polling do Pix
// O paymentId é validado contra o banco para impedir enumeração de pagamentos de outros candidatos
export async function asaasPublicRoutes(app: FastifyInstance) {
  app.get('/billing/asaas/status-public/:paymentId', async (req, reply) => {
    const { paymentId } = req.params as { paymentId: string }
    // Verifica se este paymentId pertence a algum registro de pagamento pendente no banco
    const payment = await prisma.campaignPayment.findFirst({
      where: { asaasPaymentId: paymentId },
      select: { id: true },
    })
    if (!payment) return reply.status(404).send({ error: 'Pagamento não encontrado' })
    const res = await asaas.get(`/payments/${paymentId}`)
    return reply.send({ status: res.data.status })
  })
}

// POST /billing/asaas/webhook — recebe notificações do Asaas (sem auth JWT)
export async function asaasWebhookRoutes(app: FastifyInstance) {
  app.post('/billing/asaas/webhook', async (req, reply) => {
    // Valida token de autenticação do Asaas
    const token = req.headers['asaas-access-token'] as string | undefined
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN
    if (expectedToken && token !== expectedToken) {
      logger.warn('[ASAAS WEBHOOK] Token inválido', { token })
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = req.body as any
    const event = body?.event
    const payment = body?.payment

    logger.info('[ASAAS WEBHOOK]', { event, paymentId: payment?.id })

    if (!payment?.externalReference) return reply.send({ ok: true })

    const ref = payment.externalReference as string
    const isPending = ref.startsWith('pending:')
    const pendingId = isPending ? ref.replace('pending:', '') : null
    const candidateId = isPending ? null : ref

    // PAYMENT_CONFIRMED ou PAYMENT_RECEIVED
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const paidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      const payMethod = payment.billingType === 'PIX' ? 'pix' : 'cartao'

      if (isPending && pendingId) {
        // Onboarding: ativa o pending e cria a conta
        const { getPendingRegistration, activatePendingRegistration } = await import('../auth/auth.service')
        const pending = await getPendingRegistration(pendingId)
        if (pending) {
          await activatePendingRegistration(
            pendingId,
            null,
            null,
            { method: payMethod, paidUntil },
          )
          logger.info('[ASAAS] Conta criada via webhook onboarding', { pendingId })
        }
      } else if (candidateId) {
        // Renovação de candidato existente
        const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
        if (candidate) {
          await prisma.candidate.update({
            where: { id: candidateId },
            data: { status: 'ACTIVE', campaignPaymentMethod: payMethod, campaignPaidUntil: paidUntil },
          })
          await prisma.agentConfig.updateMany({
            where: { candidateId, isActive: false },
            data: { isActive: true, deactivatedAt: null, deactivationReason: null },
          })
          logger.info('[ASAAS] Candidato ativado após pagamento', { candidateId, paidUntil })
        }
      }

      await prisma.invoice.updateMany({
        where: { externalId: payment.id },
        data: { status: 'paid' },
      })
    }

    // PAYMENT_OVERDUE → suspende candidato existente
    if (event === 'PAYMENT_OVERDUE' && candidateId) {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { status: 'SUSPENDED' },
      })
      await prisma.invoice.updateMany({
        where: { externalId: payment.id },
        data: { status: 'overdue' },
      })
    }

    return reply.send({ ok: true })
  })
}
