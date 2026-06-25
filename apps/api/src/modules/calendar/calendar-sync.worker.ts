import { Queue } from 'bullmq'
import { createWorker } from '../../lib/queue'
import { prisma } from '../../lib/prisma'
import { syncGoogleCalendarEvents } from './calendar.service'
import { logger } from '../../lib/logger'

const SYNC_INTERVAL_MS = 30 * 60 * 1000 // seção 4.7 da spec: sincronização a cada 30 minutos

function getRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  try {
    const u = new URL(url)
    return { host: u.hostname, port: Number(u.port) || 6379, username: u.username || undefined, password: u.password ? decodeURIComponent(u.password) : undefined, tls: u.protocol === 'rediss:' ? {} : undefined }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

const calendarSyncQueue = new Queue('calendar-sync', { connection: getRedisConnection() })

export function startCalendarSyncWorker() {
  const worker = createWorker<{}>(
    'calendar-sync',
    async () => {
      const candidates = await prisma.agentConfig.findMany({
        where: { googleCalendarEnabled: true },
        select: { candidateId: true },
      })
      for (const c of candidates) {
        try {
          await syncGoogleCalendarEvents(c.candidateId)
        } catch (err: any) {
          logger.error('[CALENDAR-SYNC] Falha ao sincronizar candidato', { candidateId: c.candidateId, error: err?.message })
        }
      }
    },
    1,
  )

  calendarSyncQueue.add('sync', {}, {
    repeat: { every: SYNC_INTERVAL_MS },
    jobId: 'calendar-sync-check',
  }).catch((err) => logger.error('[CALENDAR-SYNC] Falha ao agendar job repetível', err))

  return worker
}
