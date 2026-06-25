import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  eventType: z.enum(['PRESENCIAL', 'ONLINE', 'LIVE', 'DEBATE', 'REUNIAO']).default('PRESENCIAL'),
  location: z.string().max(300).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  link: z.string().url().or(z.literal('')).optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  isPublic: z.boolean().default(true),
})

// Cadastro manual de eventos pela equipe/candidato (seção 4.7 da spec) — o agente
// só lê e informa, nunca cria/altera/cancela eventos.
export async function eventRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/events', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { from, to } = req.query as Record<string, string>
    const events = await prisma.event.findMany({
      where: {
        candidateId,
        ...(from || to ? { startsAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      orderBy: { startsAt: 'asc' },
    })
    return reply.send(events)
  })

  app.post('/events', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const data = eventSchema.parse(req.body)
    const event = await prisma.event.create({
      data: {
        candidateId,
        ...data,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    })
    return reply.status(201).send(event)
  })

  app.patch('/events/:id', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const data = eventSchema.partial().parse(req.body)
    const updated = await prisma.event.updateMany({
      where: { id, candidateId },
      data: {
        ...data,
        ...(data.startsAt ? { startsAt: new Date(data.startsAt) } : {}),
        ...(data.endsAt ? { endsAt: new Date(data.endsAt) } : {}),
      },
    })
    if (updated.count === 0) return reply.status(404).send({ error: 'Evento não encontrado' })
    return reply.send(await prisma.event.findUnique({ where: { id } }))
  })

  app.delete('/events/:id', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    await prisma.event.deleteMany({ where: { id, candidateId } })
    return reply.send({ ok: true })
  })
}
