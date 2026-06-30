import axios from 'axios'
import { prisma } from '../../../lib/prisma'
import { logger } from '../../../lib/logger'

const API_VERSION = process.env.META_WHATSAPP_API_VERSION || 'v21.0'
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`

export type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'

// Consulta a Quality Rating de um número WABA na Meta (seção "Verificação de Quality
// Rating" da spec) — usada tanto pelo monitor periódico quanto para checar um número
// recém-ativado. YELLOW/RED indicam risco de banimento/throttling: o round-robin
// (lib/whatsapp-round-robin.ts) usa isso para parar de distribuir tráfego ao número.
export async function fetchQualityRating(phoneNumberId: string, accessToken: string): Promise<QualityRating> {
  try {
    const res = await axios.get(`${GRAPH_URL}/${phoneNumberId}`, {
      params: { fields: 'quality_rating' },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const rating = res.data?.quality_rating as string | undefined
    if (rating === 'GREEN' || rating === 'YELLOW' || rating === 'RED') return rating
    return 'UNKNOWN'
  } catch (err: any) {
    logger.error('[QUALITY-RATING] Falha ao consultar Meta', { phoneNumberId, error: err?.response?.data || err?.message })
    return 'UNKNOWN'
  }
}

// Atualiza a Quality Rating de todos os canais WhatsApp ativos (meta-cloud) no
// banco — roda a cada 30min (compliance.worker.ts segue o mesmo padrão de polling).
export async function refreshAllQualityRatings(): Promise<{ checked: number; degraded: number }> {
  const channels = await prisma.channel.findMany({ where: { type: 'WHATSAPP', isActive: true } })
  let checked = 0
  let degraded = 0

  for (const channel of channels) {
    const config = channel.config as any
    if (config?.provider !== 'meta-cloud' || !config?.phoneNumberId || !config?.accessToken) continue

    const rating = await fetchQualityRating(config.phoneNumberId, config.accessToken)
    if (rating === 'UNKNOWN') continue
    checked++

    const wasHealthy = config.qualityRating === 'GREEN' || !config.qualityRating
    const isDegraded = rating === 'YELLOW' || rating === 'RED'
    if (isDegraded && wasHealthy) {
      degraded++
      logger.warn('[QUALITY-RATING] Número degradado — será excluído do round-robin', { channelId: channel.id, rating })
    }

    await prisma.channel.update({
      where: { id: channel.id },
      data: { config: { ...config, qualityRating: rating, qualityRatingCheckedAt: new Date().toISOString() } },
    })
  }

  return { checked, degraded }
}
