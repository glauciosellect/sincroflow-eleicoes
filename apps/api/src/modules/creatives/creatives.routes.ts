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

    // req.file() só popula data.fields com os campos que já foram lidos do stream
    // ANTES do arquivo — como a ordem de campos no FormData não é garantida, iteramos
    // todos os parts manualmente para capturar título/tema independente da ordem de envio.
    let fileBuffer: Buffer | null = null
    let filename = ''
    let mimetype = ''
    let title = ''
    let topicKey: string | null = null

    for await (const part of req.parts()) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer()
        filename = part.filename
        mimetype = part.mimetype
      } else if (part.fieldname === 'title') {
        title = part.value as string
      } else if (part.fieldname === 'topicKey') {
        topicKey = (part.value as string) || null
      }
    }

    if (!fileBuffer) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })
    if (!title) return reply.status(400).send({ error: 'Título é obrigatório' })

    const fileUrl = await uploadCreative(candidateId, fileBuffer, filename, mimetype)
    const fileType = detectMediaType(filename)

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
