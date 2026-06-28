import { createWorker, briefingQueue } from '../../lib/queue'
import { sendWeeklyBriefingEmails } from './briefing.service'
import { logger } from '../../lib/logger'

export function startBriefingWorker() {
  const worker = createWorker<{}>(
    'weekly-briefing',
    async () => {
      await sendWeeklyBriefingEmails()
    },
    1,
  )

  briefingQueue.add('send', {}, {
    repeat: { pattern: '0 8 * * 1', tz: 'America/Sao_Paulo' }, // toda segunda às 8h (horário de Brasília)
    jobId: 'weekly-briefing',
  }).catch((err) => logger.error('[BRIEFING] Falha ao agendar job repetível', err))

  return worker
}
