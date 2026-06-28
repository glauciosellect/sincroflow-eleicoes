import { prisma } from '../../lib/prisma'
import { sendEmail } from '../../lib/mailer'
import { getOverview, getTopTopics, getRequestsStatus, getContentGaps } from './analytics.routes'

// Segunda 00:00 até domingo 23:59:59 da semana-calendário anterior à data de
// referência — não os últimos 7 dias corridos (a spec pede "resumo da semana
// anterior", e o job roda toda segunda, então a semana anterior já está fechada).
function previousWeekRange(now: Date): { gte: Date; lte: Date } {
  const dayOfWeek = now.getDay() // 0=domingo .. 6=sábado
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisMonday = new Date(now)
  thisMonday.setHours(0, 0, 0, 0)
  thisMonday.setDate(thisMonday.getDate() - daysSinceMonday)

  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(lastMonday.getDate() - 7)
  const lastSunday = new Date(thisMonday)
  lastSunday.setMilliseconds(-1)

  return { gte: lastMonday, lte: lastSunday }
}

function briefingEmailHtml(candidateName: string, range: { gte: Date; lte: Date }, data: {
  overview: Awaited<ReturnType<typeof getOverview>>
  topTopics: Awaited<ReturnType<typeof getTopTopics>>
  pendingRequests: number
  contentGaps: Awaited<ReturnType<typeof getContentGaps>>
}): string {
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR')
  const { overview, topTopics, pendingRequests, contentGaps } = data

  const topicsHtml = topTopics.length
    ? `<ul>${topTopics.slice(0, 5).map(t => `<li>${t.topicName} — ${t.count} mensagens</li>`).join('')}</ul>`
    : '<p>Nenhum tema com volume relevante nesta semana.</p>'

  const gapsHtml = contentGaps.byTopic.length
    ? `<ul>${contentGaps.byTopic.slice(0, 5).map(g => `<li>${g.topicName} — ${g.count} pergunta(s) sem resposta cadastrada</li>`).join('')}</ul>`
    : '<p>Nenhum gap de conteúdo identificado nesta semana.</p>'

  return `
    <h2>Olá, ${candidateName}!</h2>
    <p>Aqui está o resumo da sua campanha entre ${fmt(range.gte)} e ${fmt(range.lte)}:</p>

    <h3>Visão geral</h3>
    <ul>
      <li>${overview.current.conversations} conversas</li>
      <li>${overview.current.newContacts} novos contatos</li>
      <li>${overview.current.requests} solicitações recebidas</li>
      <li>${pendingRequests} solicitações pendentes (aguardando atendimento)</li>
    </ul>

    <h3>Temas em alta</h3>
    ${topicsHtml}

    <h3>Alerta de gaps de conteúdo</h3>
    ${gapsHtml}

    <p style="color:#888;font-size:13px">Você pode desativar este briefing semanal nas Configurações da sua conta.</p>
  `
}

export async function sendWeeklyBriefingEmails(): Promise<void> {
  const candidates = await prisma.candidate.findMany({
    where: { status: 'ACTIVE', weeklyBriefingEnabled: true },
    select: { id: true, email: true, name: true },
  })

  const range = previousWeekRange(new Date())

  for (const candidate of candidates) {
    const [overview, topTopics, requestsStatus, contentGaps] = await Promise.all([
      getOverview(candidate.id, range),
      getTopTopics(candidate.id, range),
      getRequestsStatus(candidate.id),
      getContentGaps(candidate.id, range),
    ])

    const pendingRequests = (requestsStatus.RECEIVED ?? 0) + (requestsStatus.ANALYZING ?? 0)

    const html = briefingEmailHtml(candidate.name, range, { overview, topTopics, pendingRequests, contentGaps })
    await sendEmail(candidate.email, 'Resumo da semana — SyncroFlowEleições', html).catch(() => {})
  }
}
