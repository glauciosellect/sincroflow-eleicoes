import type { FastifyInstance } from 'fastify'
import { logger } from '../../lib/logger'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { emitNewMessage, emitConversationUpdated } from '../../lib/socket'
import { getWhatsAppProvider } from '../channels/whatsapp/provider.factory'
import { getWorkspaceId } from '../../lib/workspace'
import { getValidGmailToken, sendReply, sendReplyWithAttachment } from '../../lib/gmail'
import { requireModule } from '../../lib/rbac'

export async function conversationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/conversations', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { status, channelId, page = '1', limit = '20', search, assignedToMe } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { candidateId }
    if (status) where.status = status
    if (channelId) where.channelId = channelId
    if (assignedToMe === 'true') where.assignedToId = sub
    if (search) where.contact = { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }

    const [conversations, total] = await prisma.$transaction([
      prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          channel: { select: { id: true, type: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.conversation.count({ where }),
    ])
    return reply.send({ data: conversations, total, page: Number(page), limit: Number(limit) })
  })

  app.get('/conversations/:id', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const conversation = await prisma.conversation.findFirst({
      where: { id, candidateId },
      include: {
        contact: true,
        channel: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!conversation) return reply.status(404).send({ error: 'Conversa não encontrada' })

    await prisma.message.updateMany({ where: { conversationId: id, isRead: false }, data: { isRead: true } })

    return reply.send(conversation)
  })

  app.get('/conversations/:id/messages', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const { page = '1', limit = '50' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const conv = await prisma.conversation.findFirst({ where: { id, candidateId } })
    if (!conv) return reply.status(404).send({ error: 'Conversa não encontrada' })

    const [messages, total] = await prisma.$transaction([
      prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        skip,
        take: Number(limit),
      }),
      prisma.message.count({ where: { conversationId: id } }),
    ])
    return reply.send({ data: messages, total })
  })

  app.post('/conversations/:id/messages', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const { content, mediaUrl, mediaType } = z.object({
      content: z.string().min(1),
      mediaUrl: z.string().optional(),
      mediaType: z.string().optional(),
    }).parse(req.body)

    const conv = await prisma.conversation.findFirst({
      where: { id, candidateId },
      include: { contact: true, channel: true },
    })
    if (!conv) return reply.status(404).send({ error: 'Conversa não encontrada' })

    const message = await prisma.message.create({
      data: { conversationId: id, senderType: 'HUMAN', content, mediaUrl, mediaType },
    })
    try { emitNewMessage(candidateId, id, message) } catch {}

    // Envia a mensagem pelo canal de origem (WhatsApp, etc.)
    try {
      if (conv.channel.type === 'WHATSAPP' && conv.contact.externalId) {
        const provider = getWhatsAppProvider()
        if (mediaUrl) {
          await provider.sendMedia(conv.channelId, conv.contact.externalId, mediaUrl, content)
        } else {
          await provider.sendText(conv.channelId, conv.contact.externalId, content)
        }
      }
      if (conv.channel.type === 'TELEGRAM' && conv.contact.externalId) {
        const cfg = conv.channel.config as any
        if (cfg?.botToken) {
          const axios = (await import('axios')).default
          await axios.post(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
            chat_id: conv.contact.externalId,
            text: content,
          })
        }
      }
      if ((conv.channel.type === 'FACEBOOK' || conv.channel.type === 'INSTAGRAM') && conv.contact.externalId) {
        const cfg = conv.channel.config as any
        if (cfg?.pageAccessToken) {
          const axios = (await import('axios')).default
          await axios.post(`https://graph.facebook.com/v21.0/${cfg.pageId}/messages`, {
            recipient: { id: conv.contact.externalId },
            message: { text: content },
          }, { params: { access_token: cfg.pageAccessToken } })
        }
      }
      // Email — responde na mesma thread, usando o metadata salvo na última mensagem recebida
      if (conv.channel.type === 'EMAIL' && conv.contact.externalId) {
        const lastInbound = await prisma.message.findFirst({
          where: { conversationId: id, senderType: 'VOTER' },
          orderBy: { createdAt: 'desc' },
        })
        const meta = (lastInbound as any)?.metadata as any
        if (meta?.threadId && meta?.messageId) {
          const accessToken = await getValidGmailToken(conv.channelId)
          if (accessToken) {
            const subject = meta.subject?.toLowerCase().startsWith('re:') ? meta.subject : `Re: ${meta.subject || ''}`
            if (mediaUrl) {
              await sendReplyWithAttachment(accessToken, {
                threadId: meta.threadId,
                messageId: meta.messageId,
                references: meta.references,
                to: conv.contact.externalId,
                subject,
                body: content,
                attachmentUrl: mediaUrl,
                attachmentName: content,
              })
            } else {
              await sendReply(accessToken, {
                threadId: meta.threadId,
                messageId: meta.messageId,
                references: meta.references,
                to: conv.contact.externalId,
                subject,
                body: content,
              })
            }
          }
        }
      }
    } catch (err: any) {
      // Log mas não falha — mensagem já está salva no banco
      logger.error('[chat] Erro ao enviar mensagem pelo canal:', err?.message)
    }

    return reply.status(201).send(message)
  })

  // Equipe assume o atendimento — o agente para de responder
  app.post('/conversations/:id/assume', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const conv = await prisma.conversation.findFirst({ where: { id, candidateId } })
    if (!conv) return reply.status(404).send({ error: 'Conversa não encontrada' })

    const updated = await prisma.conversation.update({
      where: { id },
      data: { assignedToId: sub },
    })
    const sysMsg = await prisma.message.create({
      data: { conversationId: id, senderType: 'HUMAN', content: 'Atendimento assumido pela equipe.' },
    })
    try { emitConversationUpdated(candidateId, updated) } catch {}
    try { emitNewMessage(candidateId, id, sysMsg) } catch {}
    return reply.send(updated)
  })

  // Devolve a conversa para o agente
  app.post('/conversations/:id/release', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const conv = await prisma.conversation.findFirst({ where: { id, candidateId } })
    if (!conv) return reply.status(404).send({ error: 'Conversa não encontrada' })

    const updated = await prisma.conversation.update({ where: { id }, data: { assignedToId: null } })
    const sysMsg = await prisma.message.create({
      data: { conversationId: id, senderType: 'HUMAN', content: 'Atendimento devolvido para o agente.' },
    })
    try { emitConversationUpdated(candidateId, updated) } catch {}
    try { emitNewMessage(candidateId, id, sysMsg) } catch {}
    return reply.send(updated)
  })

  app.post('/conversations/:id/urgent', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const conv = await prisma.conversation.findFirst({ where: { id, candidateId } })
    if (!conv) return reply.status(404).send({ error: 'Conversa não encontrada' })

    const updated = await prisma.conversation.update({ where: { id }, data: { status: 'URGENT' } })
    try { emitConversationUpdated(candidateId, updated) } catch {}
    return reply.send(updated)
  })

  app.post('/conversations/:id/unurgent', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const conv = await prisma.conversation.findFirst({ where: { id, candidateId } })
    if (!conv) return reply.status(404).send({ error: 'Conversa não encontrada' })

    const updated = await prisma.conversation.update({ where: { id }, data: { status: 'ACTIVE' } })
    try { emitConversationUpdated(candidateId, updated) } catch {}
    return reply.send(updated)
  })

  app.post('/conversations/:id/close', { onRequest: [requireModule('chat')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const conv = await prisma.conversation.findFirst({ where: { id, candidateId } })
    if (!conv) return reply.status(404).send({ error: 'Conversa não encontrada' })

    const updated = await prisma.conversation.update({ where: { id }, data: { status: 'CLOSED' } })
    try { emitConversationUpdated(candidateId, updated) } catch {}
    return reply.send(updated)
  })
}
