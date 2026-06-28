import { createWorker, campaignPaymentQueue } from '../../lib/queue'
import { enforceCampaignPaymentExpiry } from './campaign-payment.service'
import { logger } from '../../lib/logger'

const CHECK_INTERVAL_MS = 15 * 60 * 1000 // mesma cadência do compliance-tse

export function startCampaignPaymentWorker() {
  const worker = createWorker<{}>(
    'campaign-payment-expiry',
    async () => {
      const result = await enforceCampaignPaymentExpiry()
      if (result.suspended > 0) {
        logger.info('[CAMPAIGN-PAYMENT] Candidatos suspensos por vencimento de Pix/boleto', result)
      }
    },
    1,
  )

  campaignPaymentQueue.add('check', {}, {
    repeat: { every: CHECK_INTERVAL_MS },
    jobId: 'campaign-payment-expiry-check',
  }).catch((err) => logger.error('[CAMPAIGN-PAYMENT] Falha ao agendar job repetível', err))

  return worker
}
