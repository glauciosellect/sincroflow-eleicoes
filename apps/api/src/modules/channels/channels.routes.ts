import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { getWhatsAppProvider } from './whatsapp/provider.factory'


export async function channelRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/channels', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const channels = await prisma.channel.findMany({ where: { candidateId } })
    return reply.send(channels)
  })

  app.post('/channels/telegram', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { name, botToken } = z.object({ name: z.string(), botToken: z.string() }).parse(req.body)
    const existing = await prisma.channel.findFirst({ where: { candidateId, type: 'TELEGRAM' } })
    const channel = existing
      ? await prisma.channel.update({ where: { id: existing.id }, data: { name, config: { botToken } } })
      : await prisma.channel.create({ data: { candidateId, type: 'TELEGRAM', name, config: { botToken } } })
    const webhookUrl = `${process.env.API_URL}/webhooks/telegram/${channel.id}`
    const axios = (await import('axios')).default
    await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, { url: webhookUrl })
    return reply.status(201).send(channel)
  })

  app.post('/channels/instagram', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { name, pageAccessToken, pageId } = z.object({ name: z.string(), pageAccessToken: z.string(), pageId: z.string() }).parse(req.body)
    const existing = await prisma.channel.findFirst({ where: { candidateId, type: 'INSTAGRAM' } })
    const channel = existing
      ? await prisma.channel.update({ where: { id: existing.id }, data: { name, config: { pageAccessToken, pageId } } })
      : await prisma.channel.create({ data: { candidateId, type: 'INSTAGRAM', name, config: { pageAccessToken, pageId } } })
    return reply.status(201).send(channel)
  })

  app.post('/channels/facebook', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { name, pageAccessToken, pageId } = z.object({ name: z.string(), pageAccessToken: z.string(), pageId: z.string() }).parse(req.body)
    const existing = await prisma.channel.findFirst({ where: { candidateId, type: 'FACEBOOK' } })
    const channel = existing
      ? await prisma.channel.update({ where: { id: existing.id }, data: { name, config: { pageAccessToken, pageId } } })
      : await prisma.channel.create({ data: { candidateId, type: 'FACEBOOK', name, config: { pageAccessToken, pageId } } })
    return reply.status(201).send(channel)
  })

  app.delete('/channels/:id', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const channel = await prisma.channel.findFirst({ where: { id, candidateId } })
    if (!channel) return reply.status(404).send({ error: 'Canal não encontrado' })
    if (channel.type === 'WHATSAPP') {
      const provider = getWhatsAppProvider()
      try { await provider.deleteInstance(id) } catch {}
    }
    // Deleta em cascata: mensagens → conversas → contatos → canal
    const conversations = await prisma.conversation.findMany({ where: { channelId: id }, select: { id: true } })
    const convIds = conversations.map(c => c.id)
    if (convIds.length > 0) {
      await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } })
      await prisma.conversation.deleteMany({ where: { id: { in: convIds } } })
    }
    await prisma.contact.deleteMany({ where: { channelId: id } })
    await prisma.channel.delete({ where: { id } })
    return reply.send({ ok: true })
  })
}
