import { createWorker, complianceQueue } from '../../lib/queue'
import { enforceComplianceForAllCandidates } from './compliance.service'
import { logger } from '../../lib/logger'

const CHECK_INTERVAL_MS = 15 * 60 * 1000 // checa a cada 15 minutos — suficiente para uma janela de 72h

export function startComplianceWorker() {
  const worker = createWorker<{}>(
    'compliance-tse',
    async () => {
      const result = await enforceComplianceForAllCandidates()
      if (result.deactivated > 0 || result.reactivated > 0) {
        logger.info('[COMPLIANCE-TSE] Enforcement executado', result)
      }
    },
    1,
  )

  complianceQueue.add('check', {}, {
    repeat: { every: CHECK_INTERVAL_MS },
    jobId: 'compliance-tse-check', // evita duplicar o job repetível em restarts
  }).catch((err) => logger.error('[COMPLIANCE-TSE] Falha ao agendar job repetível', err))

  return worker
}
