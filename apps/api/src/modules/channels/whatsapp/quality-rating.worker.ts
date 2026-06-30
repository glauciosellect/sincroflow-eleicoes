import { createWorker, qualityRatingQueue } from '../../../lib/queue'
import { refreshAllQualityRatings } from './quality-rating.service'
import { logger } from '../../../lib/logger'

const CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30min, conforme checklist da spec (Fase 1)

export function startQualityRatingWorker() {
  const worker = createWorker<{}>(
    'quality-rating-check',
    async () => {
      const result = await refreshAllQualityRatings()
      if (result.checked > 0) {
        logger.info('[QUALITY-RATING] Verificação executada', result)
      }
    },
    1,
  )

  qualityRatingQueue.add('check', {}, {
    repeat: { every: CHECK_INTERVAL_MS },
    jobId: 'quality-rating-check', // evita duplicar o job repetível em restarts
  }).catch((err) => logger.error('[QUALITY-RATING] Falha ao agendar job repetível', err))

  return worker
}
