import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireSystemAdminKey } from '../../lib/system-admin'
import { createCandidateAccount, activateCampaignPayment } from '../auth/auth.service'
import { getWabaCapacitySnapshot } from '../channels/whatsapp/quality-rating.service'

// Painel /admin (fora do dashboard de candidato) — usado pelo dono do sistema para
// resolver manualmente pagamentos via Pix direto (sem Stripe Checkout), quando o
// candidato paga na chave Pix fixa e manda o comprovante pelo WhatsApp de suporte.
// Plano B: o caminho automático (Stripe Checkout com Pix/boleto nativo) já cobre a
// maioria dos casos, mas esse painel existe como margem de segurança.
export async function systemAdminRoutes(app: FastifyInstance) {

  app.get('/system/pending-registrations', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const pending = await prisma.pendingRegistration.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(pending)
  })

  app.post('/system/pending-registrations/:id/approve', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const { id } = req.params as { id: string }
    const { paymentMethod } = z.object({ paymentMethod: z.enum(['pix', 'boleto']) }).parse(req.body)

    const paidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    // Módulo 8: a conta normalmente já existe (criada no cadastro, passo 2) — este
    // painel só precisa marcar a campanha como ativada. createCandidateAccount aqui é
    // só um fallback idempotente para PendingRegistrations antigas nunca finalizadas.
    const pending = await prisma.pendingRegistration.findUnique({ where: { id } })
    if (!pending) return reply.status(400).send({ error: 'Cadastro não encontrado' })

    const existingUser = await prisma.user.findUnique({ where: { email: pending.email } })
    let candidateId: string
    if (existingUser) {
      const member = await prisma.teamMember.findFirst({ where: { userId: existingUser.id, role: 'ADMINISTRADOR' } })
      if (!member) return reply.status(400).send({ error: 'Conta encontrada, mas sem vínculo de Administrador' })
      candidateId = member.candidateId
    } else {
      const created = await createCandidateAccount(id)
      if (!created) return reply.status(400).send({ error: 'Cadastro não encontrado ou já processado' })
      candidateId = created.candidateId
    }

    await activateCampaignPayment(candidateId, { method: paymentMethod, paidUntil })
    return reply.send({ ok: true, candidateId })
  })

  app.post('/system/pending-registrations/:id/reject', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const { id } = req.params as { id: string }
    await prisma.pendingRegistration.update({ where: { id }, data: { status: 'EXPIRED', resolvedAt: new Date() } })
    return reply.send({ ok: true })
  })

  app.get('/system/candidates/search', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const { q } = req.query as { q?: string }
    if (!q || q.trim().length < 2) return reply.send([])

    const candidates = await prisma.candidate.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { cpf: { contains: q } },
        ],
      },
      select: {
        id: true, name: true, email: true, cpf: true, plan: true, status: true,
        whatsappLineLimit: true, whatsappLinesManual: true,
        activeMsgsIncluded: true, activeMsgsUsed: true, activeMsgsExtra: true,
      },
      take: 20,
    })
    return reply.send(candidates)
  })

  // Módulo 4 (SPEC-Escala-Webhooks): visibilidade de quantos números WhatsApp estão
  // ativos e qual o tier de mensagens/quality rating de cada um, para agir (pedir
  // aumento de limite à Meta, redistribuir entre WABAs) antes de travar novos cadastros.
  app.get('/system/waba-capacity', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const snapshot = await getWabaCapacitySnapshot()
    return reply.send(snapshot)
  })

  app.post('/system/candidates/:id/add-whatsapp-line', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const { id } = req.params as { id: string }
    const { quantity } = z.object({ quantity: z.number().int().min(1).max(30) }).parse(req.body)

    const updated = await prisma.candidate.update({
      where: { id },
      data: { whatsappLinesManual: { increment: quantity }, whatsappLineLimit: { increment: quantity } },
    })
    return reply.send(updated)
  })

  app.post('/system/candidates/:id/add-active-msgs', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const { id } = req.params as { id: string }
    const { quantity } = z.object({ quantity: z.number().int().min(1).max(50000) }).parse(req.body)

    const updated = await prisma.candidate.update({
      where: { id },
      data: { activeMsgsExtra: { increment: quantity } },
    })
    return reply.send(updated)
  })
}
