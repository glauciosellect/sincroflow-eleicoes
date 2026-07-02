import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface CoordenadorPayload {
  coordenadorId: string
  candidateId: string
  cidade?: string
  bairros: string[]
  type: 'coordenador'
}

// Aplica filtros de escopo (cidade/bairros) automaticamente em todas as queries
function scopeFilter(payload: CoordenadorPayload) {
  return {
    candidateId: payload.candidateId,
    ...(payload.cidade ? { cidade: payload.cidade } : {}),
    ...(payload.bairros.length > 0 ? { bairro: { in: payload.bairros } } : {}),
  }
}

// ─── Autenticação pública do coordenador ────────────────────────────────────

export async function coordenadorAuthRoutes(app: FastifyInstance) {
  // POST /coordenador/auth/login
  app.post('/coordenador/auth/login', async (req, reply) => {
    const { email, senha } = z.object({
      email: z.string().email(),
      senha: z.string().min(6),
    }).parse(req.body)

    const coord = await prisma.coordenador.findUnique({ where: { email } })
    if (!coord || !coord.ativo) return reply.status(401).send({ error: 'Credenciais inválidas' })

    const ok = await bcrypt.compare(senha, coord.senhaHash)
    if (!ok) return reply.status(401).send({ error: 'Credenciais inválidas' })

    await prisma.coordenador.update({ where: { id: coord.id }, data: { ultimoAcesso: new Date() } })

    const token = app.jwt.sign(
      { coordenadorId: coord.id, candidateId: coord.candidateId, cidade: coord.cidade ?? undefined, bairros: coord.bairros, type: 'coordenador' } as CoordenadorPayload,
      { expiresIn: '12h' }
    )

    return reply.send({
      token,
      coordenador: { id: coord.id, nome: coord.nome, cidade: coord.cidade, bairros: coord.bairros, metaVotos: coord.metaVotos },
    })
  })
}

// ─── Rotas do Coordenador (autenticadas via JWT próprio) ──────────────────────

export async function coordenadorRoutes(app: FastifyInstance) {
  // Middleware de autenticação do coordenador
  const requireCoordenador = async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
      const payload = req.user as any
      if (payload.type !== 'coordenador') throw new Error('Token inválido')
    } catch {
      return reply.status(401).send({ error: 'Acesso não autorizado' })
    }
  }

  // GET /coordenador/dashboard
  app.get('/coordenador/dashboard', { onRequest: [requireCoordenador] }, async (req, reply) => {
    const payload = req.user as unknown as CoordenadorPayload

    const [totalCadastros, checkIns] = await Promise.all([
      prisma.cadastroPortal.count({
        where: {
          portal: { candidateId: payload.candidateId },
          ...(payload.cidade ? { cidade: payload.cidade } : {}),
          ...(payload.bairros.length > 0 ? { bairro: { in: payload.bairros } } : {}),
        },
      }),
      prisma.checkInLider.count({ where: { coordenadorId: payload.coordenadorId } }),
    ])

    const coord = await prisma.coordenador.findUnique({
      where: { id: payload.coordenadorId },
      select: { nome: true, metaVotos: true, cidade: true, bairros: true },
    })

    const metaPct = coord?.metaVotos && totalCadastros > 0
      ? Math.min(100, Math.round((totalCadastros / coord.metaVotos) * 100))
      : 0

    const ultimos = await prisma.cadastroPortal.findMany({
      where: { portal: { candidateId: payload.candidateId }, ...(payload.cidade ? { cidade: payload.cidade } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, nome: true, telefone: true, cidade: true, createdAt: true },
    })

    return reply.send({
      coordenador: coord,
      stats: { totalCadastros, checkIns, metaVotos: coord?.metaVotos ?? 0, metaPct },
      ultimosCadastros: ultimos,
    })
  })

  // GET /coordenador/eleitores — lista cadastros do portal filtrados por escopo
  app.get('/coordenador/eleitores', { onRequest: [requireCoordenador] }, async (req, reply) => {
    const payload = req.user as unknown as CoordenadorPayload
    const { search, page } = req.query as { search?: string; page?: string }

    const pageNum = Math.max(1, parseInt(page ?? '1', 10))
    const take = 30
    const skip = (pageNum - 1) * take

    const scopeWhere = {
      portal: { candidateId: payload.candidateId },
      ...(payload.cidade ? { cidade: payload.cidade } : {}),
      ...(payload.bairros.length > 0 ? { bairro: { in: payload.bairros } } : {}),
      ...(search ? { nome: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.cadastroPortal.findMany({ where: scopeWhere, orderBy: { createdAt: 'desc' }, take, skip }),
      prisma.cadastroPortal.count({ where: scopeWhere }),
    ])

    return reply.send({ items, total, page: pageNum, pages: Math.ceil(total / take) })
  })

  // POST /coordenador/eleitores — cadastra eleitor (via portal)
  app.post('/coordenador/eleitores', { onRequest: [requireCoordenador] }, async (req, reply) => {
    const payload = req.user as unknown as CoordenadorPayload

    const data = z.object({
      nome: z.string().min(2),
      telefone: z.string().min(8),
      email: z.string().email().optional().or(z.literal('')),
      cidade: z.string().optional(),
      bairro: z.string().optional(),
      assunto: z.string().optional(),
      mensagem: z.string().optional(),
    }).parse(req.body)

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId: payload.candidateId } })
    if (!portal) return reply.status(400).send({ error: 'Portal não configurado para este candidato' })

    const cadastro = await prisma.cadastroPortal.create({
      data: {
        portalId: portal.id,
        nome: data.nome,
        telefone: data.telefone,
        email: data.email || undefined,
        cidade: data.cidade ?? payload.cidade ?? undefined,
        bairro: data.bairro,
        assunto: data.assunto,
        mensagem: data.mensagem,
      },
    })

    await prisma.portalEleitor.update({ where: { id: portal.id }, data: { totalCadastros: { increment: 1 } } })

    return reply.status(201).send(cadastro)
  })

  // POST /coordenador/checkin — registrar visita/check-in com líder
  app.post('/coordenador/checkin', { onRequest: [requireCoordenador] }, async (req, reply) => {
    const payload = req.user as unknown as CoordenadorPayload

    const { liderId, tipo, observacao } = z.object({
      liderId: z.string().min(1),
      tipo: z.enum(['visita', 'ligacao', 'reuniao', 'evento']),
      observacao: z.string().max(500).optional(),
    }).parse(req.body)

    const checkIn = await prisma.checkInLider.create({
      data: {
        liderId,
        coordenadorId: payload.coordenadorId,
        candidateId: payload.candidateId,
        tipo,
        observacao,
      },
    })

    return reply.status(201).send(checkIn)
  })

  // GET /coordenador/checkins — histórico de check-ins do coordenador
  app.get('/coordenador/checkins', { onRequest: [requireCoordenador] }, async (req, reply) => {
    const payload = req.user as unknown as CoordenadorPayload

    const checkIns = await prisma.checkInLider.findMany({
      where: { coordenadorId: payload.coordenadorId },
      orderBy: { dataCheckin: 'desc' },
      take: 50,
    })

    return reply.send(checkIns)
  })
}

// ─── Rotas do painel do candidato para gestão de coordenadores ───────────────

export async function coordenadorPainelRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /painel/coordenadores — lista todos os coordenadores
  app.get('/painel/coordenadores', { onRequest: [requireModule('settings')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const coordenadores = await prisma.coordenador.findMany({
      where: { candidateId },
      select: {
        id: true, nome: true, email: true, telefone: true, cidade: true,
        bairros: true, metaVotos: true, ativo: true, ultimoAcesso: true, createdAt: true,
        _count: { select: { checkIns: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(coordenadores)
  })

  // POST /painel/coordenadores — cria novo coordenador
  app.post('/painel/coordenadores', { onRequest: [requireModule('settings')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = z.object({
      nome: z.string().min(2).max(120),
      email: z.string().email(),
      senha: z.string().min(6),
      telefone: z.string().optional(),
      cidade: z.string().optional(),
      bairros: z.array(z.string()).default([]),
      metaVotos: z.number().int().positive().optional(),
    }).parse(req.body)

    const exists = await prisma.coordenador.findUnique({ where: { email: data.email } })
    if (exists) return reply.status(409).send({ error: 'E-mail já cadastrado' })

    const senhaHash = await bcrypt.hash(data.senha, 10)

    const coord = await prisma.coordenador.create({
      data: { candidateId, nome: data.nome, email: data.email, senhaHash, telefone: data.telefone, cidade: data.cidade, bairros: data.bairros, metaVotos: data.metaVotos },
      select: { id: true, nome: true, email: true, cidade: true, bairros: true, metaVotos: true, ativo: true, createdAt: true },
    })

    await auditLog({ candidateId, eventType: 'coordenador_created', metadata: { coordenadorId: coord.id, email: data.email } })

    return reply.status(201).send(coord)
  })

  // PATCH /painel/coordenadores/:id — atualiza (cidade, bairros, meta, ativo, senha)
  app.patch('/painel/coordenadores/:id', { onRequest: [requireModule('settings')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const coord = await prisma.coordenador.findFirst({ where: { id, candidateId } })
    if (!coord) return reply.status(404).send({ error: 'Coordenador não encontrado' })

    const data = z.object({
      nome: z.string().min(2).max(120).optional(),
      telefone: z.string().optional(),
      cidade: z.string().optional().nullable(),
      bairros: z.array(z.string()).optional(),
      metaVotos: z.number().int().positive().optional().nullable(),
      ativo: z.boolean().optional(),
      novaSenha: z.string().min(6).optional(),
    }).parse(req.body)

    const updateData: any = {}
    if (data.nome !== undefined) updateData.nome = data.nome
    if (data.telefone !== undefined) updateData.telefone = data.telefone
    if (data.cidade !== undefined) updateData.cidade = data.cidade
    if (data.bairros !== undefined) updateData.bairros = data.bairros
    if (data.metaVotos !== undefined) updateData.metaVotos = data.metaVotos
    if (data.ativo !== undefined) updateData.ativo = data.ativo
    if (data.novaSenha) updateData.senhaHash = await bcrypt.hash(data.novaSenha, 10)

    const updated = await prisma.coordenador.update({
      where: { id },
      data: updateData,
      select: { id: true, nome: true, email: true, cidade: true, bairros: true, metaVotos: true, ativo: true },
    })

    return reply.send(updated)
  })

  // DELETE /painel/coordenadores/:id
  app.delete('/painel/coordenadores/:id', { onRequest: [requireModule('settings')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const coord = await prisma.coordenador.findFirst({ where: { id, candidateId } })
    if (!coord) return reply.status(404).send({ error: 'Coordenador não encontrado' })

    await prisma.coordenador.delete({ where: { id } })
    return reply.status(204).send()
  })

  // GET /painel/coordenadores/:id/atividade — relatório de atividade
  app.get('/painel/coordenadores/:id/atividade', { onRequest: [requireModule('settings')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const coord = await prisma.coordenador.findFirst({ where: { id, candidateId } })
    if (!coord) return reply.status(404).send({ error: 'Coordenador não encontrado' })

    const checkIns = await prisma.checkInLider.findMany({
      where: { coordenadorId: id },
      orderBy: { dataCheckin: 'desc' },
      take: 100,
    })

    const totalEleitores = await prisma.cadastroPortal.count({
      where: {
        portal: { candidateId },
        ...(coord.cidade ? { cidade: coord.cidade } : {}),
        ...(coord.bairros.length > 0 ? { bairro: { in: coord.bairros } } : {}),
      },
    })

    return reply.send({ coordenador: { id: coord.id, nome: coord.nome, cidade: coord.cidade, bairros: coord.bairros, metaVotos: coord.metaVotos }, checkIns, totalEleitores })
  })
}
