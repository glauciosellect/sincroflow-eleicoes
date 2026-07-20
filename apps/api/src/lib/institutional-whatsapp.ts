import axios from 'axios'
import { logger } from './logger'
import { normalizeBrazilianNumber } from '../modules/channels/whatsapp/providers/meta-cloud.provider'

// Envia mensagens pelo número institucional da SyncroFlow (+55 32 9116-4716),
// fora do fluxo de Channel-por-candidato: usado para comunicação
// plataforma → candidato (ex: boas-vindas no cadastro), não candidato → eleitor.
const API_VERSION = process.env.META_WHATSAPP_API_VERSION || 'v21.0'
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`

export async function sendInstitutionalWhatsAppText(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.META_INSTITUTIONAL_PHONE_NUMBER_ID
  const accessToken = process.env.META_INSTITUTIONAL_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) {
    logger.warn('[INSTITUTIONAL-WHATSAPP] META_INSTITUTIONAL_PHONE_NUMBER_ID/ACCESS_TOKEN não configurados — envio ignorado')
    return
  }

  try {
    await axios.post(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: normalizeBrazilianNumber(to),
      type: 'text',
      text: { body: text },
    }, { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch (err: any) {
    logger.error('[INSTITUTIONAL-WHATSAPP] Falha ao enviar mensagem:', err?.response?.data || err?.message)
  }
}
