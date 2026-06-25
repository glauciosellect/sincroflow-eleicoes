import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'

export async function requestRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/requests', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { status, search, contactId, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { candidateId }
    if (status) where.status = status
    if (contactId) where.contactId = contactId
    if (search) where.OR = [
      { protocolNumber: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { contact: { name: { contains: search, mode: 'insensitive' } } },
    ]

    const [requests, total] = await prisma.$transaction([
      prisma.request.findMany({
        where,
        include: { contact: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.request.count({ where }),
    ])
    return reply.send({ data: requests, total, page: Number(page), limit: Number(limit) })
  })

  app.get('/requests/:id', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const request = await prisma.request.findFirst({
      where: { id, candidateId },
      include: { contact: true },
    })
    if (!request) return reply.status(404).send({ error: 'Solicitação não encontrada' })
    return reply.send(request)
  })

  app.patch('/requests/:id/status', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const { status } = z.object({
      status: z.enum(['RECEIVED', 'ANALYZING', 'FORWARDED', 'RESOLVED']),
    }).parse(req.body)

    const request = await prisma.request.findFirst({ where: { id, candidateId } })
    if (!request) return reply.status(404).send({ error: 'Solicitação não encontrada' })

    const updated = await prisma.request.update({
      where: { id },
      data: {
        status,
        resolvedBy: status === 'RESOLVED' ? sub : request.resolvedBy,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    })
    return reply.send(updated)
  })
}
