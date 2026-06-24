import { prisma } from '../../lib/prisma'
import { getValidToken, listCalendarEvents } from '../../lib/google'

const TZ = 'America/Sao_Paulo'

// O agente eleitoral apenas INFORMA compromissos cadastrados pela equipe/candidato
// ou importados do Google Calendar — nunca cria, altera ou cancela eventos
// (Resolução TSE nº 23.755/2026, ver docs/spec-eleicoes/04-modulos/4.7-agenda.md).

// Lista os próximos eventos da agenda do candidato (para o agente informar)
export async function listUpcomingEvents(candidateId: string, days = 7): Promise<{
  available: boolean
  events: { title: string; startsAt: Date; location: string | null; link: string | null }[]
  message: string
}> {
  const now = new Date()
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  const events = await prisma.event.findMany({
    where: { candidateId, isPublic: true, startsAt: { gte: now, lte: until } },
    orderBy: { startsAt: 'asc' },
  })

  const eventLines = events.map((e) => {
    const start = e.startsAt.toLocaleString('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    return `• ${start} — ${e.title}${e.location ? ` (${e.location})` : ''}`
  }).join('\n')

  return {
    available: true,
    events: events.map(e => ({ title: e.title, startsAt: e.startsAt, location: e.location, link: e.link })),
    message: events.length === 0
      ? `Não há compromissos públicos agendados nos próximos ${days} dias.`
      : `Compromissos da agenda nos próximos ${days} dias:\n${eventLines}`,
  }
}

// Sincroniza eventos públicos do Google Calendar do candidato (chamado a cada 30 min)
export async function syncGoogleCalendarEvents(candidateId: string): Promise<void> {
  const config = await prisma.agentConfig.findUnique({
    where: { candidateId },
    select: { googleCalendarEnabled: true, googleCalendarId: true },
  })
  if (!config?.googleCalendarEnabled) return

  const accessToken = await getValidToken(candidateId)
  if (!accessToken) return

  const calendarId = config.googleCalendarId || 'primary'
  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const events = await listCalendarEvents(accessToken, calendarId, timeMin, timeMax)

  for (const e of events) {
    if (!e.id || !e.start?.dateTime) continue
    await prisma.event.upsert({
      where: { googleEventId: e.id },
      update: {
        title: e.summary || 'Evento',
        description: e.description || null,
        startsAt: new Date(e.start.dateTime),
        endsAt: e.end?.dateTime ? new Date(e.end.dateTime) : null,
      },
      create: {
        candidateId,
        title: e.summary || 'Evento',
        description: e.description || null,
        eventType: 'PRESENCIAL',
        startsAt: new Date(e.start.dateTime),
        endsAt: e.end?.dateTime ? new Date(e.end.dateTime) : null,
        isPublic: true,
        googleEventId: e.id,
      },
    })
  }
}

// Contexto de agenda para o prompt do agente — apenas eventos públicos futuros
export async function getAgendaContextForPrompt(candidateId: string): Promise<string> {
  try {
    const { events, message } = await listUpcomingEvents(candidateId, 14)
    if (events.length === 0) return ''
    return `\n\n[CONTEXTO INTERNO — NÃO MENCIONE AO USUÁRIO: ${message}\nUse esta lista apenas para responder se o eleitor perguntar sobre compromissos/eventos da campanha. Você NUNCA cria, altera ou cancela compromissos — apenas informa os já cadastrados.]`
  } catch {
    return ''
  }
}
