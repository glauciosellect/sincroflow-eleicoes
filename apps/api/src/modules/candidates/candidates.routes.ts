import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'
import { sendEmail, teamInviteEmail } from '../../lib/mailer'

async function getCandidateForUser(userId: string) {
  const membership = await prisma.teamMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { candidate: true },
    orderBy: { acceptedAt: 'asc' },
  })
  if (!membership) throw new Error('Candidato não encontrado')
  return { candidate: membership.candidate, role: membership.role }
}

function requireAdmin(role: string, reply: any) {
  if (role !== 'ADMINISTRADOR') {
    reply.status(403).send({ error: 'Sem permissão' })
    return false
  }
  return true
}

export async function candidateRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/candidates/me', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { candidate, role } = await getCandidateForUser(sub)
    return reply.send({ ...candidate, role })
  })

  app.patch('/candidates/me', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { candidate, role } = await getCandidateForUser(sub)
    if (!requireAdmin(role, reply)) return
    const data = z.object({
      name: z.string().min(2).max(120).optional(),
      candidateNumber: z.string().max(20).optional(),
      party: z.string().max(60).optional(),
      position: z.string().max(60).optional(),
      state: z.string().max(2).optional(),
      city: z.string().max(120).optional(),
      photoUrl: z.string().url().optional(),
      whatsapp: z.string().min(8).optional(),
    }).parse(req.body)
    const updated = await prisma.candidate.update({ where: { id: candidate.id }, data })
    return reply.send(updated)
  })

  // —— Equipe ————————————————————————————————————————————————————————

  app.get('/candidates/me/team', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { candidate } = await getCandidateForUser(sub)
    const members = await prisma.teamMember.findMany({
      where: { candidateId: candidate.id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { invitedAt: 'asc' },
    })
    return reply.send(members)
  })

  app.patch('/candidates/me/team/:id', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { role } = await getCandidateForUser(sub)
    if (!requireAdmin(role, reply)) return
    const { id } = req.params as { id: string }
    const { role: newRole } = z.object({
      role: z.enum(['ADMINISTRADOR', 'ATENDIMENTO', 'CONTEUDO', 'RELATORIOS', 'AGENTE_CAMPO']),
    }).parse(req.body)
    const updated = await prisma.teamMember.update({
      where: { id },
      data: { role: newRole },
    })
    return reply.send(updated)
  })

  app.delete('/candidates/me/team/:id', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { role } = await getCandidateForUser(sub)
    if (!requireAdmin(role, reply)) return
    const { id } = req.params as { id: string }
    await prisma.teamMember.update({
      where: { id },
      data: { status: 'REMOVED' },
    })
    return reply.send({ ok: true })
  })

  // —— Convites ——————————————————————————————————————————————————————

  app.get('/candidates/me/team/invites', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { candidate } = await getCandidateForUser(sub)
    const invites = await prisma.teamMember.findMany({
      where: { candidateId: candidate.id, status: 'PENDING' },
      orderBy: { invitedAt: 'desc' },
    })
    return reply.send(invites)
  })

  app.post('/candidates/me/team/invite', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { candidate, role } = await getCandidateForUser(sub)
    if (!requireAdmin(role, reply)) return

    const { name, email, role: inviteRole } = z.object({
      name: z.string().min(2).max(120),
      email: z.string().email(),
      role: z.enum(['ADMINISTRADOR', 'ATENDIMENTO', 'CONTEUDO', 'RELATORIOS', 'AGENTE_CAMPO']).default('ATENDIMENTO'),
    }).parse(req.body)

    const inviter = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } })

    const token = crypto.randomBytes(32).toString('hex')

    await prisma.teamMember.upsert({
      where: { candidateId_email: { candidateId: candidate.id, email } },
      update: { name, role: inviteRole, inviteToken: token, status: 'PENDING', acceptedAt: null, invitedAt: new Date() },
      create: { candidateId: candidate.id, name, email, role: inviteRole, inviteToken: token },
    })

    const acceptUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`
    await sendEmail(
      email,
      `Convite para a campanha de ${candidate.name} — SyncroFlowEleições`,
      teamInviteEmail(inviter?.name || 'Alguém', candidate.name, inviteRole, acceptUrl),
    )

    return reply.status(201).send({ ok: true })
  })

  app.delete('/candidates/me/team/invites/:id', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { candidate, role } = await getCandidateForUser(sub)
    if (!requireAdmin(role, reply)) return
    const { id } = req.params as { id: string }
    await prisma.teamMember.deleteMany({ where: { id, candidateId: candidate.id, status: 'PENDING' } })
    return reply.send({ ok: true })
  })

  // Excluir conta (irreversível, só Administrador)
  app.delete('/candidates/me', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { candidate, role } = await getCandidateForUser(sub)
    if (!requireAdmin(role, reply)) return

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversation: { candidateId: candidate.id } } }),
      prisma.request.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.conversation.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.contact.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.event.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.platformTopic.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.agentConfig.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.teamMember.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.auditLog.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.candidate.delete({ where: { id: candidate.id } }),
      prisma.session.deleteMany({ where: { userId: sub } }),
      prisma.user.delete({ where: { id: sub } }),
    ])

    return reply.send({ ok: true })
  })
}
