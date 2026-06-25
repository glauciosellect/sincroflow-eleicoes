import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { getWorkspaceId } from '../../../lib/workspace'
import { getGmailOAuthUrl } from '../../../lib/gmail'
import { exchangeCodeForTokens, getGoogleUserInfo } from '../../../lib/google'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:3001'

export async function emailChannelRoutes(app: FastifyInstance) {
  // Aceita token via query param pois é um redirect de browser (sem header Authorization) —
  // mesmo padrão de /integrations/google/connect.
  app.get('/channels/email/connect', async (req, reply) => {
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

    const redirectUri = `${API_URL}/channels/email/callback`
    const url = getGmailOAuthUrl(redirectUri, member.candidateId)
    return reply.redirect(url)
  })

  app.get('/channels/email/callback', async (req, reply) => {
    const { code, state: candidateId, error } = req.query as Record<string, string>
    const redirectBase = `${FRONTEND_URL}/settings?tab=channels`

    if (error || !code || !candidateId) {
      return reply.redirect(`${redirectBase}&email=error`)
    }

    try {
      const redirectUri = `${API_URL}/channels/email/callback`
      const tokens = await exchangeCodeForTokens(code, redirectUri)
      const { email } = await getGoogleUserInfo(tokens.access_token)

      const existingEmail = await prisma.channel.findFirst({ where: { candidateId, type: 'EMAIL' } })
      if (existingEmail) {
        await prisma.channel.update({
          where: { id: existingEmail.id },
          data: {
            name: email,
            config: {
              provider: 'gmail',
              email,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token ?? undefined,
              tokenExpiry: new Date(tokens.expiry_date).toISOString(),
            },
          },
        })
      } else {
        await prisma.channel.create({
          data: {
            candidateId,
            type: 'EMAIL',
            name: email,
            config: {
              provider: 'gmail',
              email,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token ?? null,
              tokenExpiry: new Date(tokens.expiry_date).toISOString(),
              allowedSenders: [],
            },
          },
        })
      }

      return reply.redirect(`${redirectBase}&email=success`)
    } catch (err) {
      console.error('[EMAIL] Erro no callback de conexão:', err)
      return reply.redirect(`${redirectBase}&email=error`)
    }
  })

  app.patch('/channels/:id/email-settings', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const channel = await prisma.channel.findFirst({ where: { id, candidateId, type: 'EMAIL' } })
    if (!channel) return reply.status(404).send({ error: 'Canal não encontrado' })

    const { allowedSenders } = z.object({ allowedSenders: z.array(z.string()) }).parse(req.body)

    await prisma.channel.update({
      where: { id },
      data: { config: { ...(channel.config as any), allowedSenders: allowedSenders.map(s => s.trim().toLowerCase()).filter(Boolean) } },
    })

    return reply.send({ ok: true })
  })
}
