import { createWorker, alertsQueue } from '../../lib/queue'
import { notifyCriticalAlertsByEmail } from './alerts.service'
import { logger } from '../../lib/logger'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // checa a cada hora — pico/TSE não mudam minuto a minuto

export function startAlertsWorker() {
  const worker = createWorker<{}>(
    'alerts-email',
    async () => {
      await notifyCriticalAlertsByEmail()
    },
    1,
  )

  alertsQueue.add('check', {}, {
    repeat: { every: CHECK_INTERVAL_MS },
    jobId: 'alerts-email-check',
  }).catch((err) => logger.error('[ALERTS] Falha ao agendar job repetível', err))

  return worker
}
