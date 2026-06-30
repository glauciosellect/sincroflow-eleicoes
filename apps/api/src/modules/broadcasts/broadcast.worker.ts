import type { Job } from 'bullmq'
import { prisma } from '../../lib/prisma'
import { createWorker } from '../../lib/queue'
import { getWhatsAppProvider } from '../channels/whatsapp/provider.factory'
import { getValidGmailToken, sendNewEmailWithAttachment } from '../../lib/gmail'
import { emitNewMessage } from '../../lib/socket'
import { isWhatsAppWindowOpen, WABA_TEMPLATES } from '../../lib/whatsapp-window'
import { sendTelegramCreative } from '../../lib/telegram-broadcast'

export type BroadcastJobData = {
  broadcastId: string
  contactId: string
}

async function finalizeIfDone(broadcastId: string) {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } })
  if (!broadcast) return
  if (broadcast.sentCount + broadcast.failedCount >= broadcast.totalTargets) {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: broadcast.failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
        completedAt: new Date(),
      },
    })
  }
}

async function processBroadcastJob(job: Job<BroadcastJobData>) {
  const { broadcastId, contactId } = job.data

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { creative: true, channel: true },
  })
  if (!broadcast) return

  if (broadcast.status === 'QUEUED') {
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'SENDING' } })
  }

  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) {
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { failedCount: { increment: 1 } } })
    await finalizeIfDone(broadcastId)
    return
  }

  try {
    if (broadcast.channel.type === 'EMAIL') {
      const accessToken = await getValidGmailToken(broadcast.channelId)
      if (!accessToken) throw new Error('Token do Gmail inválido ou expirado')
      await sendNewEmailWithAttachment(accessToken, {
        to: contact.externalId,
        subject: broadcast.creative.title,
        body: broadcast.creative.title,
        attachmentUrl: broadcast.creative.fileUrl,
        attachmentName: broadcast.creative.title,
      })
    } else if (broadcast.channel.type === 'TELEGRAM') {
      const botToken = (broadcast.channel.config as any)?.botToken
      if (!botToken) throw new Error('Canal Telegram sem botToken configurado')
      await sendTelegramCreative(botToken, contact.externalId, broadcast.creative.fileUrl, broadcast.creative.fileType, broadcast.creative.title)
    } else {
      const provider = getWhatsAppProvider()
      const windowOpen = await isWhatsAppWindowOpen(contact.id)
      if (windowOpen) {
        await provider.sendMedia(broadcast.channelId, contact.externalId, broadcast.creative.fileUrl, broadcast.creative.title)
      } else {
        if (!provider.sendTemplate) throw new Error('Provedor WhatsApp não suporta envio de template (necessário fora da janela de 24h)')
        const { name, languageCode } = WABA_TEMPLATES.reengagement
        await provider.sendTemplate(broadcast.channelId, contact.externalId, name, languageCode, [contact.name || 'eleitor'], broadcast.creative.fileUrl)
      }
    }

    let conversation = await prisma.conversation.findFirst({
      where: { channelId: broadcast.channelId, contactId: contact.id, status: { not: 'CLOSED' } },
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { candidateId: broadcast.candidateId, channelId: broadcast.channelId, contactId: contact.id, status: 'ACTIVE' },
      })
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'AGENT',
        content: broadcast.creative.title,
        mediaUrl: broadcast.creative.fileUrl,
        mediaType: broadcast.creative.fileType,
        isActiveMessage: true,
      },
    })
    try { emitNewMessage(broadcast.candidateId, conversation.id, message) } catch {}

    await prisma.$transaction([
      prisma.broadcast.update({ where: { id: broadcastId }, data: { sentCount: { increment: 1 } } }),
      prisma.candidate.update({ where: { id: broadcast.candidateId }, data: { activeMsgsUsed: { increment: 1 } } }),
      prisma.broadcastRecipient.create({ data: { broadcastId, contactId } }),
    ])
  } catch (err: any) {
    console.error('[BROADCAST] Falha ao enviar para contato', contactId, err?.response?.data || err?.message)
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { failedCount: { increment: 1 } } })
  }

  await finalizeIfDone(broadcastId)
}

export function startBroadcastWorker() {
  createWorker<BroadcastJobData>('broadcast', processBroadcastJob, 5)
}
