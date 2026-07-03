import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { uploadCreative, deleteCreativeFile } from '../../lib/storage'
import { detectMediaType } from '../channels/whatsapp/providers/meta-cloud.provider'
import { requireModule } from '../../lib/rbac'

const STABILITY_KEY = process.env.STABILITY_API_KEY ?? ''

// Prompts em português → traduz para inglês contextualizado para eleições brasileiras
async function generateBackground(prompt: string, width: number, height: number): Promise<Buffer> {
  // Enriquece o prompt com contexto gráfico para propaganda política
  const enhancedPrompt = [
    prompt,
    'Brazilian political campaign material, professional graphic design, vibrant colors,',
    'photorealistic background, no text, no people faces, dramatic lighting,',
    'high quality print ready, 300dpi equivalent detail',
  ].join(' ')

  const negativePrompt = 'text, letters, words, watermark, signature, logo, face, person, ugly, blurry, low quality, nsfw'

  const body = {
    text_prompts: [
      { text: enhancedPrompt, weight: 1 },
      { text: negativePrompt, weight: -1 },
    ],
    cfg_scale: 7,
    height,
    width,
    samples: 1,
    steps: 30,
  }

  const res = await fetch(
    `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${STABILITY_KEY}`,
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Stability AI error ${res.status}: ${err}`)
  }

  const data = await res.json() as { artifacts: Array<{ base64: string }> }
  return Buffer.from(data.artifacts[0].base64, 'base64')
}

export async function creativeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/creatives', { onRequest: [requireModule('story')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { topicKey } = req.query as { topicKey?: string }

    const creatives = await prisma.creative.findMany({
      where: { candidateId, ...(topicKey ? { topicKey } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(creatives)
  })

  app.post('/creatives', { onRequest: [requireModule('story')] }, async (req, reply) => {
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

  // POST /creatives/generate-bg — gera imagem de fundo via Stability AI
  app.post('/creatives/generate-bg', { onRequest: [requireModule('story')] }, async (req, reply) => {
    if (!STABILITY_KEY) return reply.status(503).send({ error: 'Geração de imagem não configurada' })

    const { prompt, format } = z.object({
      prompt: z.string().min(5).max(400),
      format: z.enum(['santinho', 'story', 'banner']).default('santinho'),
    }).parse(req.body)

    // Dimensões suportadas pelo SDXL 1.0 (múltiplos de 64)
    const dims: Record<string, { width: number; height: number }> = {
      santinho: { width: 832,  height: 1216 },
      story:    { width: 832,  height: 1216 },
      banner:   { width: 1344, height: 768  },
    }
    const { width, height } = dims[format]

    try {
      const imgBuffer = await generateBackground(prompt, width, height)
      // Retorna base64 direto para o frontend usar no canvas
      return reply.send({ base64: `data:image/png;base64,${imgBuffer.toString('base64')}` })
    } catch (e: any) {
      return reply.status(502).send({ error: e.message ?? 'Erro ao gerar imagem' })
    }
  })

  app.delete('/creatives/:id', { onRequest: [requireModule('story')] }, async (req, reply) => {
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
