import axios from 'axios'
import { prisma } from '../../../lib/prisma'
import { logger } from '../../../lib/logger'

const API_VERSION = process.env.META_WHATSAPP_API_VERSION || 'v21.0'
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`

export type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'

// Tier de mensagens da Meta (conversas únicas iniciadas pelo negócio a cada 24h) —
// sobe automaticamente conforme qualidade/uso do número. Módulo 4 da SPEC-Escala-Webhooks:
// visibilidade de quanto cada número está perto do limite antes de travar novos cadastros.
export type MessagingLimitTier =
  | 'TIER_50' | 'TIER_250' | 'TIER_1K' | 'TIER_10K' | 'TIER_100K' | 'TIER_UNLIMITED' | 'UNKNOWN'

const TIER_NUMERIC_LIMIT: Record<MessagingLimitTier, number | null> = {
  TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_10K: 10000, TIER_100K: 100000,
  TIER_UNLIMITED: null, UNKNOWN: null,
}

export function tierLimit(tier: MessagingLimitTier): number | null {
  return TIER_NUMERIC_LIMIT[tier] ?? null
}

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

// Consulta o tier de mensagens (limite de conversas únicas/24h) do número.
export async function fetchMessagingLimitTier(phoneNumberId: string, accessToken: string): Promise<MessagingLimitTier> {
  try {
    const res = await axios.get(`${GRAPH_URL}/${phoneNumberId}`, {
      params: { fields: 'messaging_limit_tier' },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const tier = res.data?.messaging_limit_tier as string | undefined
    if (tier && tier in TIER_NUMERIC_LIMIT) return tier as MessagingLimitTier
    return 'UNKNOWN'
  } catch (err: any) {
    logger.error('[QUALITY-RATING] Falha ao consultar tier de mensagens', { phoneNumberId, error: err?.response?.data || err?.message })
    return 'UNKNOWN'
  }
}

// Limite conhecido de números de telefone por WABA no nível de verificação atual da
// Business Manager — a Meta não expõe isso via API, então é mantido como config manual
// (atualizar conforme o nível de verificação subir). Ver runbook operacional do Módulo 4.
const KNOWN_WABA_PHONE_LIMIT = Number(process.env.META_WABA_PHONE_LIMIT) || 20
const WABA_LIMIT_WARNING_RATIO = 0.8 // alerta a partir de 80% do limite conhecido

// Atualiza a Quality Rating e o tier de mensagens de todos os canais WhatsApp ativos
// (meta-cloud) no banco — roda a cada 30min (compliance.worker.ts segue o mesmo padrão
// de polling). Também alerta quando o total de números ativos se aproxima do limite
// conhecido da WABA (Módulo 4 da SPEC-Escala-Webhooks).
export async function refreshAllQualityRatings(): Promise<{ checked: number; degraded: number; totalActive: number; nearWabaLimit: boolean }> {
  const channels = await prisma.channel.findMany({ where: { type: 'WHATSAPP', isActive: true } })
  let checked = 0
  let degraded = 0

  for (const channel of channels) {
    const config = channel.config as any
    if (config?.provider !== 'meta-cloud' || !config?.phoneNumberId || !config?.accessToken) continue

    const [rating, tier] = await Promise.all([
      fetchQualityRating(config.phoneNumberId, config.accessToken),
      fetchMessagingLimitTier(config.phoneNumberId, config.accessToken),
    ])
    if (rating === 'UNKNOWN' && tier === 'UNKNOWN') continue
    checked++

    const wasHealthy = config.qualityRating === 'GREEN' || !config.qualityRating
    const isDegraded = rating === 'YELLOW' || rating === 'RED'
    if (isDegraded && wasHealthy) {
      degraded++
      logger.warn('[QUALITY-RATING] Número degradado — será excluído do round-robin', { channelId: channel.id, rating })
    }

    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        config: {
          ...config,
          qualityRating: rating,
          messagingLimitTier: tier,
          qualityRatingCheckedAt: new Date().toISOString(),
        },
      },
    })
  }

  const totalActive = channels.length
  const nearWabaLimit = totalActive >= KNOWN_WABA_PHONE_LIMIT * WABA_LIMIT_WARNING_RATIO
  if (nearWabaLimit) {
    logger.warn('[QUALITY-RATING] Número de canais WhatsApp ativos perto do limite conhecido da WABA', {
      totalActive, limit: KNOWN_WABA_PHONE_LIMIT,
    })
  }

  return { checked, degraded, totalActive, nearWabaLimit }
}

// Painel/diagnóstico: status atual de todos os números WhatsApp ativos, para visibilidade
// administrativa (Módulo 4, critério de aceite: "existe um lugar onde dá pra ver quantos
// números estão ativos e qual o tier/limite de cada um").
export async function getWabaCapacitySnapshot() {
  const channels = await prisma.channel.findMany({
    where: { type: 'WHATSAPP', isActive: true },
    select: { id: true, candidateId: true, name: true, config: true },
  })

  const numbers = channels.map((c) => {
    const config = c.config as any
    const tier = (config?.messagingLimitTier as MessagingLimitTier) || 'UNKNOWN'
    return {
      channelId: c.id,
      candidateId: c.candidateId,
      name: c.name,
      provider: config?.provider === 'meta-cloud' && config?.salvyVirtualPhoneAccountId ? 'salvy' : 'embedded-signup',
      qualityRating: (config?.qualityRating as QualityRating) || 'UNKNOWN',
      messagingLimitTier: tier,
      messagingLimit: tierLimit(tier),
      checkedAt: config?.qualityRatingCheckedAt || null,
    }
  })

  return {
    totalActive: numbers.length,
    wabaPhoneLimit: KNOWN_WABA_PHONE_LIMIT,
    nearWabaLimit: numbers.length >= KNOWN_WABA_PHONE_LIMIT * WABA_LIMIT_WARNING_RATIO,
    numbers,
  }
}
