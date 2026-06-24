import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'


export async function contactRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/contacts', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { search, channelType, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { candidateId }
    if (channelType) where.channelType = channelType
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ]

    const [contacts, total] = await prisma.$transaction([
      prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
      prisma.contact.count({ where }),
    ])
    return reply.send({ data: contacts, total, page: Number(page), limit: Number(limit) })
  })

  app.get('/contacts/:id', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const contact = await prisma.contact.findFirst({ where: { id, candidateId } })
    if (!contact) return reply.status(404).send({ error: 'Contato não encontrado' })
    return reply.send(contact)
  })

  app.patch('/contacts/:id', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const data = z.object({
      name: z.string().optional(),
      phone: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(req.body)

    const updated = await prisma.contact.updateMany({ where: { id, candidateId }, data })
    if (updated.count === 0) return reply.status(404).send({ error: 'Contato não encontrado' })
    return reply.send(await prisma.contact.findUnique({ where: { id } }))
  })

  app.delete('/contacts/:id', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    await prisma.contact.deleteMany({ where: { id, candidateId } })
    return reply.send({ ok: true })
  })

  app.get('/contacts/:id/conversations', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const contact = await prisma.contact.findFirst({ where: { id, candidateId } })
    if (!contact) return reply.status(404).send({ error: 'Contato não encontrado' })
    const conversations = await prisma.conversation.findMany({
      where: { contactId: id, candidateId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(conversations)
  })
}
