import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'

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

  // Ativa o "Modo Mandato" — upgrade de plano após a eleição (seção 4.11 da spec)
  app.post('/billing/upgrade-mandate', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const updated = await prisma.candidate.update({ where: { id: candidateId }, data: { plan: 'MANDATE' } })
    return reply.send(updated)
  })
}
