import bcrypt from 'bcryptjs'
import * as speakeasy from 'speakeasy'
import * as qrcode from 'qrcode'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { sendEmail, passwordResetEmail } from '../../lib/mailer'
import type { RegisterInput, LoginInput } from './auth.schema'

const DEFAULT_DISCLAIMER = (name: string, position?: string, party?: string) => `
Olá! Sou o assistente virtual da campanha de ${name}${position ? `, pré-candidato(a) a ${position}` : ''}${party ? ` pelo ${party}` : ''}.
Estou aqui para responder suas dúvidas sobre as propostas, informar sobre eventos e registrar suas sugestões.
Como posso ajudar você hoje?
`.trim()

// Passo 1 do registro (seção 4.1 da spec): valida e guarda os dados temporariamente.
// A conta (User + Candidate) só é criada de fato após o pagamento ser aprovado —
// automaticamente pelo webhook do Stripe (cartão) ou manualmente no painel /admin
// (Pix/boleto, sem confirmação automática madura no Brasil ainda). Persistido em
// tabela (não Redis com TTL) porque a aprovação manual pode levar horas/dias.
export async function createPendingRegistration(input: RegisterInput): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw new Error('Email já cadastrado')

  const existingCandidate = await prisma.candidate.findUnique({ where: { cpf: input.cpf } })
  if (existingCandidate) throw new Error('CPF já cadastrado')

  const passwordHash = await bcrypt.hash(input.password, 12)

  // paymentMethod/plan só são conhecidos no passo 2 (escolha de plano e forma de
  // pagamento) — aqui ainda é só o passo 1 (dados pessoais). Atualizados depois por
  // updatePendingRegistrationPayment, chamado tanto pelo checkout Stripe quanto pelo
  // fallback manual (Pix direto, sem Stripe, ver system-admin.routes.ts).
  const pending = await prisma.pendingRegistration.create({
    data: {
      name: input.name,
      cpf: input.cpf,
      candidateNumber: input.candidateNumber,
      email: input.email,
      whatsapp: input.whatsapp,
      passwordHash,
      paymentMethod: 'card',
    },
  })

  return pending.id
}

export async function updatePendingRegistrationPayment(pendingId: string, paymentMethod: 'card' | 'pix' | 'boleto', plan: 'CAMPAIGN' | 'MANDATE') {
  await prisma.pendingRegistration.update({ where: { id: pendingId }, data: { paymentMethod, plan } })
}

export async function getPendingRegistration(pendingId: string) {
  return prisma.pendingRegistration.findUnique({ where: { id: pendingId, status: 'PENDING' } })
}

// Passo 2: chamado pelo webhook do Stripe (cartão/Pix/boleto via Checkout) quando o
// pagamento é aprovado, OU manualmente pelo painel /admin (Pix/boleto sem checkout,
// aprovação humana). Cria a conta de fato — User, Candidate (status ACTIVE),
// TeamMember (Administrador) e AgentConfig.
export async function activatePendingRegistration(
  pendingId: string,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  campaignPayment?: { method: string; paidUntil: Date; cargo?: string },
): Promise<{ userId: string; candidateId: string } | null> {
  const pending = await getPendingRegistration(pendingId)
  if (!pending) return null

  const existing = await prisma.user.findUnique({ where: { email: pending.email } })
  if (existing) return null // já ativado (webhook duplicado)

  const candidate = await prisma.candidate.create({
    data: {
      name: pending.name,
      cpf: pending.cpf,
      candidateNumber: pending.candidateNumber,
      email: pending.email,
      whatsapp: pending.whatsapp,
      stripeCustomerId,
      stripeSubscriptionId,
      status: 'ACTIVE',
      plan: 'CAMPAIGN',
      ...(campaignPayment ? {
        campaignPaymentMethod: campaignPayment.method,
        campaignPaidUntil: campaignPayment.paidUntil,
        ...(campaignPayment.cargo ? { position: campaignPayment.cargo } : {}),
      } : {}),
      agentConfig: {
        create: {
          disclaimer: DEFAULT_DISCLAIMER(pending.name),
        },
      },
    },
  })

  const user = await prisma.user.create({
    data: {
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
      phone: pending.whatsapp,
      onboardingDone: false,
      teamMemberships: {
        create: {
          candidateId: candidate.id,
          name: pending.name,
          email: pending.email,
          role: 'ADMINISTRADOR',
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      },
    },
  })

  await prisma.pendingRegistration.update({ where: { id: pendingId }, data: { status: 'APPROVED', resolvedAt: new Date() } })

  return { userId: user.id, candidateId: candidate.id }
}

export async function loginUser(input: LoginInput, signTokens: (userId: string, candidateId?: string) => { accessToken: string; refreshToken: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      teamMemberships: {
        where: { status: 'ACTIVE' },
        include: { candidate: true },
        orderBy: { acceptedAt: 'asc' },
      },
    },
  })
  if (!user || !user.passwordHash) throw new Error('Credenciais inválidas')

  const valid = await bcrypt.compare(input.password, user.passwordHash)
  if (!valid) throw new Error('Credenciais inválidas')

  if (user.twoFactorEnabled) {
    if (!input.totpCode) throw new Error('Código 2FA obrigatório')
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token: input.totpCode,
      window: 1,
    })
    if (!verified) throw new Error('Código 2FA inválido')
  }

  const members = user.teamMemberships
  const preferred = members.find(m => m.role === 'ADMINISTRADOR') ?? members[0]
  const candidate = preferred?.candidate

  const tokens = signTokens(user.id, candidate?.id)
  await saveRefreshToken(user.id, tokens.refreshToken)

  return { user: sanitize(user), candidate, role: preferred?.role, ...tokens }
}

export async function refreshTokens(
  oldRefreshToken: string,
  signTokens: (userId: string, candidateId?: string) => { accessToken: string; refreshToken: string }
) {
  const session = await prisma.session.findUnique({
    where: { refreshToken: oldRefreshToken },
    include: { user: true },
  })
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } })
    throw new Error('Refresh token inválido ou expirado')
  }

  const member = await prisma.teamMember.findFirst({
    where: { userId: session.userId, status: 'ACTIVE' },
    orderBy: { acceptedAt: 'asc' },
    include: { candidate: true },
  })

  const tokens = signTokens(session.userId, member?.candidateId)
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return { user: sanitize(session.user), candidate: member?.candidate ?? null, ...tokens }
}

export async function logoutUser(refreshToken: string) {
  await prisma.session.deleteMany({ where: { refreshToken } })
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return

  const token = crypto.randomBytes(32).toString('hex')
  await redis.set(`reset:${token}`, user.id, 'EX', 3600)

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
  await sendEmail(user.email, 'Redefinição de senha — SyncroFlowEleições', passwordResetEmail(user.name, resetUrl))
}

export async function resetPassword(token: string, newPassword: string) {
  const userId = await redis.get(`reset:${token}`)
  if (!userId) throw new Error('Token inválido ou expirado')

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
  await redis.del(`reset:${token}`)
  await prisma.session.deleteMany({ where: { userId } })
}

export async function setup2FA(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('Usuário não encontrado')

  const secret = speakeasy.generateSecret({ name: `SyncroFlowEleições (${user.email})`, length: 20 })
  await redis.set(`2fa_setup:${userId}`, secret.base32!, 'EX', 600)

  const qrCode = await qrcode.toDataURL(secret.otpauth_url!)
  return { qrCode, secret: secret.base32 }
}

export async function verify2FA(userId: string, totpCode: string) {
  const secret = await redis.get(`2fa_setup:${userId}`)
  if (!secret) throw new Error('Setup 2FA expirado. Reinicie o processo.')

  const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: totpCode, window: 1 })
  if (!valid) throw new Error('Código inválido')

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret, twoFactorEnabled: true },
  })
  await redis.del(`2fa_setup:${userId}`)
}

export async function disable2FA(userId: string, totpCode: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.twoFactorSecret) throw new Error('2FA não habilitado')

  const valid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: totpCode,
    window: 1,
  })
  if (!valid) throw new Error('Código inválido')

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: null, twoFactorEnabled: false },
  })
}

export async function saveRefreshToken(userId: string, refreshToken: string) {
  await prisma.session.create({
    data: {
      userId,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
}

function sanitize(user: { id: string; name: string; email: string; avatarUrl: string | null; twoFactorEnabled: boolean; onboardingDone: boolean; language: string; theme: string }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    twoFactorEnabled: user.twoFactorEnabled,
    onboardingDone: user.onboardingDone,
    language: user.language,
    theme: user.theme,
  }
}
