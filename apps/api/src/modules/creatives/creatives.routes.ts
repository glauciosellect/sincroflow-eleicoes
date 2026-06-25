import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { uploadCreative, deleteCreativeFile } from '../../lib/storage'
import { detectMediaType } from '../channels/whatsapp/providers/meta-cloud.provider'

export async function creativeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/creatives', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { topicKey } = req.query as { topicKey?: string }

    const creatives = await prisma.creative.findMany({
      where: { candidateId, ...(topicKey ? { topicKey } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(creatives)
  })

  app.post('/creatives', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const fields = data.fields as Record<string, any>
    const title = fields.title?.value
    const topicKey = fields.topicKey?.value || null
    if (!title) return reply.status(400).send({ error: 'Título é obrigatório' })

    const buffer = await data.toBuffer()
    const fileUrl = await uploadCreative(candidateId, buffer, data.filename, data.mimetype)
    const fileType = detectMediaType(data.filename)

    const creative = await prisma.creative.create({
      data: { candidateId, title, topicKey, fileUrl, fileType },
    })
    return reply.status(201).send(creative)
  })

  app.delete('/creatives/:id', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const creative = await prisma.creative.findFirst({ where: { id, candidateId } })
    if (!creative) return reply.status(404).send({ error: 'Criativo não encontrado' })

    await prisma.creative.delete({ where: { id } })
    await deleteCreativeFile(creative.fileUrl)
    return reply.send({ ok: true })
  })
}
