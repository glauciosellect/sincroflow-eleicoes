import { createWorker, emailPollQueue, messageQueue } from '../../../lib/queue'
import { logger } from '../../../lib/logger'
import { prisma } from '../../../lib/prisma'
import { getValidGmailToken, listNewMessages, getMessage, markAsRead } from '../../../lib/gmail'

const POLL_INTERVAL_MS = 5 * 60 * 1000

// Por padrão processa e-mail de qualquer remetente (igual o WhatsApp processa
// qualquer número) — blockedSenders é uma lista opcional de bloqueio, não de permissão.
function isSenderBlocked(from: string, blockedSenders: string[]): boolean {
  if (!blockedSenders?.length) return false
  const lower = from.toLowerCase()
  return blockedSenders.some((rule) => {
    const r = rule.toLowerCase()
    return r.startsWith('@') ? lower.endsWith(r) : lower === r
  })
}

// Remetentes de notificação automática conhecidos (segurança de conta, no-reply,
// etc.) — nunca são eleitores reais, sempre ignorados independente de blockedSenders.
// `from` aqui já vem normalizado só com o endereço (sem nome), ver lib/gmail.ts:120.
const SYSTEM_SENDER_PATTERNS = [
  /no-?reply@/i,
  /@accounts\.google\.com$/i,
  /naoresponda@/i,
  /mailer-daemon@/i,
  /postmaster@/i,
]

function isSystemSender(from: string): boolean {
  return SYSTEM_SENDER_PATTERNS.some((pattern) => pattern.test(from))
}

// Cada canal de e-mail usa sua própria conta Gmail — a quota de 250 unidades/s da
// Gmail API é por usuário/token, não compartilhada entre canais. Processar canais em
// paralelo (com um teto) evita que 1000+ caixas de e-mail sejam varridas sequencialmente
// e estourem o intervalo de polling de 5 min (Módulo 5 da SPEC-Escala-Webhooks).
const CHANNEL_CONCURRENCY = 10

async function pollChannel(channel: { id: string; config: unknown }) {
  const cfg = channel.config as any
  const blockedSenders: string[] = cfg?.blockedSenders || []

  const accessToken = await getValidGmailToken(channel.id)
  if (!accessToken) {
    logger.error(`[EMAIL-POLL] Token inválido para canal ${channel.id} — pulando`)
    return
  }

  const messageIds = await listNewMessages(accessToken, 'is:unread -from:me')
  for (const messageId of messageIds) {
    const msg = await getMessage(accessToken, messageId)
    if (!msg) continue

    if (isSystemSender(msg.from) || isSenderBlocked(msg.from, blockedSenders)) {
      await markAsRead(accessToken, messageId)
      continue
    }

    await messageQueue.add('process', {
      channelId: channel.id,
      channelType: 'EMAIL',
      payload: msg,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    })

    await markAsRead(accessToken, messageId)
  }
}

export function startEmailPollingWorker() {
  // Agenda o job repetitivo (idempotente — BullMQ não duplica se já existir
  // um repeat job idêntico registrado).
  emailPollQueue.add('poll', {}, { repeat: { every: POLL_INTERVAL_MS }, jobId: 'email-poll-recurring' }).catch((err) => {
    logger.error('[EMAIL-POLL] Erro ao agendar job recorrente:', err?.message)
  })

  return createWorker<Record<string, never>>(
    'email-poll',
    async () => {
      const channels = await prisma.channel.findMany({ where: { type: 'EMAIL', isActive: true } })

      for (let i = 0; i < channels.length; i += CHANNEL_CONCURRENCY) {
        const batch = channels.slice(i, i + CHANNEL_CONCURRENCY)
        await Promise.all(batch.map((channel) =>
          pollChannel(channel).catch((err) => {
            logger.error(`[EMAIL-POLL] Erro ao processar canal ${channel.id}:`, err?.message)
          })
        ))
      }
    },
    1, // um único job repetitivo por vez — o paralelismo real é entre canais dentro do job (CHANNEL_CONCURRENCY)
  )
}
