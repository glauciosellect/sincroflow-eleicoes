import { prisma } from '../../lib/prisma'
import { sendEmail } from '../../lib/mailer'
import { getComplianceStatus } from '../compliance/compliance.service'
import { PLATFORM_TOPICS } from '../../lib/platform-topics'

const PEAK_THRESHOLD_PERCENT = 30 // seção 4.13: 30%+ acima da média
const GAP_THRESHOLD_COUNT = 10 // seção 4.13: 10+ perguntas sem resposta
const GAP_WINDOW_DAYS = 7
const TSE_WARNING_DAYS = 7

export interface AlertItem {
  type: 'peak' | 'content_gap' | 'urgent' | 'tse_deactivation'
  message: string
  data?: Record<string, any>
}

// Alerta 1: pico de mensagens sobre um tema — compara últimas 24h com a média diária dos
// 7 dias anteriores (mesma janela de tempo).
async function getPeakAlerts(candidateId: string): Promise<AlertItem[]> {
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [recentByTopic, baselineByTopic] = await Promise.all([
    prisma.message.groupBy({
      by: ['topicKey'],
      where: { topicKey: { not: null }, createdAt: { gte: last24h }, conversation: { candidateId } },
      _count: true,
    }),
    prisma.message.groupBy({
      by: ['topicKey'],
      where: { topicKey: { not: null }, createdAt: { gte: last7d, lt: last24h }, conversation: { candidateId } },
      _count: true,
    }),
  ])

  const baselineMap = new Map(baselineByTopic.map(b => [b.topicKey, b._count / 6])) // média diária dos 6 dias anteriores às últimas 24h
  const alerts: AlertItem[] = []

  for (const recent of recentByTopic) {
    const baseline = baselineMap.get(recent.topicKey) ?? 0
    if (baseline === 0) continue // sem histórico suficiente para comparar
    const changePercent = ((recent._count - baseline) / baseline) * 100
    if (changePercent >= PEAK_THRESHOLD_PERCENT) {
      const topicName = PLATFORM_TOPICS.find(t => t.key === recent.topicKey)?.name ?? recent.topicKey
      alerts.push({
        type: 'peak',
        message: `Volume de mensagens sobre "${topicName}" está ${Math.round(changePercent)}% acima da média nas últimas 24h.`,
        data: { topicKey: recent.topicKey, topicName, changePercent: Math.round(changePercent) },
      })
    }
  }

  return alerts
}

// Alerta 2: gap de conteúdo — 10+ perguntas sem resposta sobre o mesmo tema em 7 dias
async function getContentGapAlerts(candidateId: string): Promise<AlertItem[]> {
  const since = new Date(Date.now() - GAP_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const gaps = await prisma.message.groupBy({
    by: ['topicKey'],
    where: { isContentGap: true, topicKey: { not: null }, createdAt: { gte: since }, conversation: { candidateId } },
    _count: true,
  })

  return gaps
    .filter(g => g._count >= GAP_THRESHOLD_COUNT)
    .map(g => {
      const topicName = PLATFORM_TOPICS.find(t => t.key === g.topicKey)?.name ?? g.topicKey
      return {
        type: 'content_gap' as const,
        message: `${g._count} eleitores perguntaram sobre "${topicName}" nos últimos ${GAP_WINDOW_DAYS} dias, mas você ainda não cadastrou propostas para esse tema.`,
        data: { topicKey: g.topicKey, topicName, count: g._count },
      }
    })
}

// Alerta 3: conversas marcadas como urgentes (detecção automática já feita no message.worker)
async function getUrgentAlerts(candidateId: string): Promise<AlertItem[]> {
  const urgentConversations = await prisma.conversation.findMany({
    where: { candidateId, status: 'URGENT' },
    include: { contact: { select: { name: true, phone: true } } },
    orderBy: { lastMessageAt: 'desc' },
    take: 20,
  })

  return urgentConversations.map(c => ({
    type: 'urgent' as const,
    message: `Conversa urgente com ${c.contact.name || c.contact.phone || 'eleitor'} precisa de atenção da equipe.`,
    data: { conversationId: c.id, contactName: c.contact.name, contactPhone: c.contact.phone },
  }))
}

// Alerta 4: aviso TSE — 7 dias antes da desativação automática
async function getTseAlert(candidateId: string): Promise<AlertItem[]> {
  const status = await getComplianceStatus(candidateId)
  if (status.daysUntilDeactivation !== null && status.daysUntilDeactivation <= TSE_WARNING_DAYS && status.daysUntilDeactivation > 0) {
    return [{
      type: 'tse_deactivation',
      message: `Faltam ${status.daysUntilDeactivation} dia(s) para a desativação automática do seu assistente (exigência da Resolução TSE nº 23.755/2026).`,
      data: { daysUntilDeactivation: status.daysUntilDeactivation, electionDate: status.round?.electionDate },
    }]
  }
  return []
}

export async function getAlertsForCandidate(candidateId: string): Promise<AlertItem[]> {
  const [peak, gaps, urgent, tse] = await Promise.all([
    getPeakAlerts(candidateId),
    getContentGapAlerts(candidateId),
    getUrgentAlerts(candidateId),
    getTseAlert(candidateId),
  ])
  return [...tse, ...urgent, ...peak, ...gaps]
}

// Roda periodicamente (ver alerts.worker.ts) — envia e-mail só para os alertas mais
// críticos (pico e TSE), para não gerar spam a cada conversa urgente individual.
export async function notifyCriticalAlertsByEmail(): Promise<void> {
  const candidates = await prisma.candidate.findMany({ where: { status: 'ACTIVE' }, select: { id: true, email: true, name: true } })

  for (const candidate of candidates) {
    const [peak, tse] = await Promise.all([
      getPeakAlerts(candidate.id),
      getTseAlert(candidate.id),
    ])
    const critical = [...tse, ...peak]
    if (critical.length === 0) continue

    const lines = critical.map(a => `<li>${a.message}</li>`).join('')
    await sendEmail(
      candidate.email,
      'Alertas da sua campanha — SyncroFlowEleições',
      `<h2>Olá, ${candidate.name}!</h2><p>Temos alertas importantes sobre sua campanha:</p><ul>${lines}</ul>`,
    ).catch(() => {})
  }
}
