import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verify2FASchema,
} from './auth.schema'
import {
  createPendingRegistration,
  loginUser,
  refreshTokens,
  logoutUser,
  forgotPassword,
  resetPassword,
  setup2FA,
  verify2FA,
  disable2FA,
} from './auth.service'

export async function authRoutes(app: FastifyInstance) {
  const signTokens = (userId: string, candidateId?: string) => ({
    accessToken: app.jwt.sign({ sub: userId, wid: candidateId }, { expiresIn: '15m' }),
    refreshToken: app.jwt.sign({ sub: userId, type: 'refresh' }, { expiresIn: '7d' }),
  })

  // Rate limit estrito: 10 tentativas por 15 minutos por IP
  const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }

  // Passo 1 do registro (dados do candidato) — não cria a conta ainda.
  // A conta só é criada após o pagamento ser aprovado (ver billing/stripe.routes.ts).
  app.post('/auth/register', authRateLimit, async (req, reply) => {
    const input = registerSchema.parse(req.body)
    const pendingId = await createPendingRegistration(input)
    return reply.status(201).send({ pendingId })
  })

  app.post('/auth/login', authRateLimit, async (req, reply) => {
    const input = loginSchema.parse(req.body)
    const result = await loginUser(input, signTokens)
    return reply.send(result)
  })

  app.post('/auth/refresh', async (req, reply) => {
    const { refreshToken } = refreshSchema.parse(req.body)
    const result = await refreshTokens(refreshToken, signTokens)
    return reply.send(result)
  })

  app.post('/auth/logout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    await logoutUser(refreshToken)
    return reply.send({ ok: true })
  })

  app.post('/auth/forgot-password', authRateLimit, async (req, reply) => {
    const { email } = forgotPasswordSchema.parse(req.body)
    await forgotPassword(email)
    return reply.send({ ok: true })
  })

  app.post('/auth/reset-password', authRateLimit, async (req, reply) => {
    const { token, password } = resetPasswordSchema.parse(req.body)
    await resetPassword(token, password)
    return reply.send({ ok: true })
  })

  app.get('/auth/2fa/setup', { onRequest: [app.authenticate] }, async (req, reply) => {
    const result = await setup2FA((req.user as { sub: string }).sub)
    return reply.send(result)
  })

  app.post('/auth/2fa/verify', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { totpCode } = verify2FASchema.parse(req.body)
    await verify2FA((req.user as { sub: string }).sub, totpCode)
    return reply.send({ ok: true })
  })

  app.post('/auth/2fa/disable', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { totpCode } = verify2FASchema.parse(req.body)
    await disable2FA((req.user as { sub: string }).sub, totpCode)
    return reply.send({ ok: true })
  })

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { prisma } = await import('../../lib/prisma')
    const user = await prisma.user.findUnique({
      where: { id: sub },
      include: { teamMemberships: { where: { status: 'ACTIVE' }, include: { candidate: true } } },
    })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })
    const { passwordHash, twoFactorSecret, ...safeUser } = user
    return reply.send(safeUser)
  })

  // Colaborador convidado define sua senha e aceita o convite
  app.post('/auth/invite/accept', async (req, reply) => {
    const { prisma } = await import('../../lib/prisma')
    const bcrypt = (await import('bcryptjs')).default
    const { saveRefreshToken } = await import('./auth.service')
    const { token, password } = z.object({ token: z.string(), password: z.string().min(8) }).parse(req.body)

    const invite = await prisma.teamMember.findUnique({ where: { inviteToken: token } })
    if (!invite || invite.status !== 'PENDING') {
      return reply.status(400).send({ error: 'Convite inválido ou já utilizado' })
    }

    let user = await prisma.user.findUnique({ where: { email: invite.email } })
    if (!user) {
      const passwordHash = await bcrypt.hash(password, 12)
      user = await prisma.user.create({
        data: { name: invite.name, email: invite.email, passwordHash, onboardingDone: false },
      })
    }

    await prisma.teamMember.update({
      where: { id: invite.id },
      data: { userId: user.id, status: 'ACTIVE', acceptedAt: new Date(), inviteToken: null },
    })

    const tokens = signTokens(user.id, invite.candidateId)
    await saveRefreshToken(user.id, tokens.refreshToken)

    return reply.send({ ok: true, candidateId: invite.candidateId, ...tokens })
  })

  app.patch('/auth/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { prisma } = await import('../../lib/prisma')
    const data = z.object({
      name: z.string().optional(),
      phone: z.string().optional().nullable(),
      language: z.string().optional(),
      theme: z.string().optional(),
      onboardingDone: z.boolean().optional(),
      onboardingData: z.any().optional(),
    }).parse(req.body)
    const user = await prisma.user.update({ where: { id: sub }, data })
    const { passwordHash, twoFactorSecret, ...safeUser } = user
    return reply.send(safeUser)
  })
}
