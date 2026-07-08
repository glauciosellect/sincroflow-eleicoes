import type { FastifyInstance } from 'fastify'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import {
  getOAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserInfo,
  listCalendars,
  getValidToken,
} from '../../lib/google'
import { requireModule } from '../../lib/rbac'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:3001'

// Login social (Google) foi removido: a conta só pode ser criada via fluxo de
// registro + pagamento aprovado (ver docs/spec-eleicoes/04-modulos/4.1-autenticacao-registro.md).
// Este módulo cobre apenas a integração de agenda (Google Calendar).
export async function googleRoutes(app: FastifyInstance) {

  // ── GOOGLE CALENDAR — conectar candidato ─────────────────────────────────
  app.get('/integrations/google/connect', async (req, reply) => {
    const { token, wid } = req.query as Record<string, string>
    if (!token) return reply.status(401).send({ error: 'Não autorizado' })

    let userId: string
    try {
      const decoded = app.jwt.verify(token) as { sub: string; type?: string }
      userId = decoded.sub
    } catch {
      try {
        const decoded = app.jwt.verify(token, { key: process.env.JWT_REFRESH_SECRET || '' }) as { sub: string }
        userId = decoded.sub
      } catch {
        return reply.status(401).send({ error: 'Token inválido' })
      }
    }

    const member = await prisma.teamMember.findFirst({
      where: wid ? { candidateId: wid, userId } : { userId },
      orderBy: { acceptedAt: 'asc' },
    })
    if (!member) return reply.status(404).send({ error: 'Candidato não encontrado' })

    const redirectUri = `${API_URL}/integrations/google/callback`
    const url = getOAuthUrl(redirectUri, member.candidateId)
    return reply.redirect(url)
  })

  app.get('/integrations/google/callback', async (req, reply) => {
    const { code, state: candidateId, error } = req.query as Record<string, string>
    const redirectBase = `${FRONTEND_URL}/integrations`

    if (error || !code || !candidateId) {
      return reply.redirect(`${redirectBase}?google=error`)
    }

    try {
      const redirectUri = `${API_URL}/integrations/google/callback`
      const tokens = await exchangeCodeForTokens(code, redirectUri)
      const { email } = await getGoogleUserInfo(tokens.access_token)

      const calendars = await listCalendars(tokens.access_token)
      const campaignCal = calendars.find(c => c.summary.toLowerCase().includes('campanha'))
      const calendarId = campaignCal?.id ?? 'primary'

      const existingConfig = await prisma.agentConfig.findUnique({
        where: { candidateId },
        select: { googleRefreshToken: true },
      })

      await prisma.agentConfig.update({
        where: { candidateId },
        data: {
          googleCalendarEnabled: true,
          googleCalendarEmail: email,
          googleCalendarId: calendarId,
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token ?? existingConfig?.googleRefreshToken ?? null,
          googleTokenExpiry: new Date(tokens.expiry_date),
        },
      })

      return reply.redirect(`${redirectBase}?google=success`)
    } catch (err) {
      logger.error('[Google] Calendar Callback]', err)
      return reply.redirect(`${redirectBase}?google=error`)
    }
  })

  // ── GOOGLE CALENDAR — status e disconnect ────────────────────────────────
  app.get('/integrations/google', { onRequest: [app.authenticate, requireModule('agenda')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const member = await prisma.teamMember.findFirst({ where: wid ? { candidateId: wid, userId: sub } : { userId: sub }, orderBy: { acceptedAt: 'asc' } })
    if (!member) return reply.status(404).send({ error: 'Candidato não encontrado' })

    const config = await prisma.agentConfig.findUnique({
      where: { candidateId: member.candidateId },
      select: { googleCalendarEnabled: true, googleCalendarEmail: true, googleCalendarId: true },
    })

    if (!config?.googleCalendarEnabled) {
      return reply.send({ connected: false, email: null, calendarId: null, tokenExpired: false })
    }

    const accessToken = await getValidToken(member.candidateId)
    const tokenExpired = !accessToken

    return reply.send({
      connected: true,
      email: config.googleCalendarEmail ?? null,
      calendarId: config.googleCalendarId ?? null,
      tokenExpired,
    })
  })

  app.delete('/integrations/google', { onRequest: [app.authenticate, requireModule('agenda')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const member = await prisma.teamMember.findFirst({ where: wid ? { candidateId: wid, userId: sub } : { userId: sub }, orderBy: { acceptedAt: 'asc' } })
    if (!member) return reply.status(404).send({ error: 'Candidato não encontrado' })

    await prisma.agentConfig.update({
      where: { candidateId: member.candidateId },
      data: {
        googleCalendarEnabled: false,
        googleCalendarEmail: null,
        googleCalendarId: null,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
      },
    })
    return reply.send({ ok: true })
  })

  // ── GOOGLE CALENDAR — eventos (consulta direta; ver também calendar.service.ts) ──
  app.get('/integrations/google/events', { onRequest: [app.authenticate, requireModule('agenda')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const member = await prisma.teamMember.findFirst({ where: wid ? { candidateId: wid, userId: sub } : { userId: sub }, orderBy: { acceptedAt: 'asc' } })
    if (!member) return reply.status(404).send({ error: 'Candidato não encontrado' })

    const { timeMin, timeMax } = req.query as Record<string, string>
    const config = await prisma.agentConfig.findUnique({
      where: { candidateId: member.candidateId },
      select: { googleCalendarEnabled: true, googleCalendarId: true },
    })

    if (!config?.googleCalendarEnabled) return reply.send({ events: [], connected: false })

    const accessToken = await getValidToken(member.candidateId)
    if (!accessToken) return reply.send({ events: [], connected: false })

    const { listCalendarEvents } = await import('../../lib/google')
    const events = await listCalendarEvents(accessToken, config.googleCalendarId || 'primary', timeMin, timeMax)
    return reply.send({ events, connected: true })
  })
}
