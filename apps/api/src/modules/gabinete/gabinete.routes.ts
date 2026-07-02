import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'

function gerarNumeroProtocolo() {
  const ano = new Date().getFullYear()
  const seq = String(Date.now()).slice(-6)
  return `GAB-${ano}-${seq}`
}

export async function gabineteRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── AUDIÊNCIAS ──────────────────────────────────────────────────────────────

  app.get('/gabinete/audiencias', { onRequest: [requireModule('agenda')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { status, page, dataInicio, dataFim } = req.query as { status?: string; page?: string; dataInicio?: string; dataFim?: string }
    const pageNum = Math.max(1, parseInt(page ?? '1', 10))
    const take = 20

    const where: Record<string, unknown> = { candidateId }
    if (status) where.status = status
    if (dataInicio || dataFim) {
      where.dataHora = {
        ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
        ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59') } : {}),
      }
    }

    const [items, total] = await Promise.all([
      prisma.audiencia.findMany({ where, orderBy: { dataHora: 'asc' }, take, skip: (pageNum - 1) * take }),
      prisma.audiencia.count({ where }),
    ])
    return reply.send({ items, total, page: pageNum, pages: Math.ceil(total / take) })
  })

  app.post('/gabinete/audiencias', { onRequest: [requireModule('agenda')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = z.object({
      titulo: z.string().min(2).max(200),
      solicitante: z.string().min(2).max(200),
      telefone: z.string().optional(),
      email: z.string().email().optional(),
      assunto: z.string().min(2).max(500),
      descricao: z.string().optional(),
      dataHora: z.string().datetime({ offset: true }),
      local: z.string().optional(),
      prioridade: z.enum(['normal', 'alta', 'urgente']).default('normal'),
    }).parse(req.body)

    const audiencia = await prisma.audiencia.create({ data: { candidateId, ...data, dataHora: new Date(data.dataHora) } })
    await auditLog({ candidateId, eventType: 'audiencia_criada', metadata: { id: audiencia.id } })
    return reply.status(201).send(audiencia)
  })

  app.patch('/gabinete/audiencias/:id', { onRequest: [requireModule('agenda')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const existing = await prisma.audiencia.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })

    const data = z.object({
      titulo: z.string().optional(),
      solicitante: z.string().optional(),
      telefone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      assunto: z.string().optional(),
      descricao: z.string().optional().nullable(),
      dataHora: z.string().optional(),
      local: z.string().optional().nullable(),
      status: z.enum(['agendada', 'realizada', 'cancelada', 'reagendada']).optional(),
      prioridade: z.enum(['normal', 'alta', 'urgente']).optional(),
      encaminhamento: z.string().optional().nullable(),
      resultado: z.string().optional().nullable(),
    }).parse(req.body)

    const updated = await prisma.audiencia.update({
      where: { id },
      data: { ...data, ...(data.dataHora ? { dataHora: new Date(data.dataHora) } : {}) },
    })
    return reply.send(updated)
  })

  app.delete('/gabinete/audiencias/:id', { onRequest: [requireModule('agenda')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const existing = await prisma.audiencia.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })
    await prisma.audiencia.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── PROJETOS DE LEI ─────────────────────────────────────────────────────────

  app.get('/gabinete/projetos', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { status, tipo, page } = req.query as { status?: string; tipo?: string; page?: string }
    const pageNum = Math.max(1, parseInt(page ?? '1', 10))
    const take = 20

    const where: Record<string, unknown> = { candidateId }
    if (status) where.status = status
    if (tipo) where.tipo = tipo

    const [items, total] = await Promise.all([
      prisma.projetoLei.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip: (pageNum - 1) * take }),
      prisma.projetoLei.count({ where }),
    ])
    return reply.send({ items, total, page: pageNum, pages: Math.ceil(total / take) })
  })

  app.post('/gabinete/projetos', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = z.object({
      numero: z.string().optional(),
      titulo: z.string().min(2).max(300),
      ementa: z.string().min(5),
      tipo: z.enum(['pl', 'pec', 'requerimento', 'indicacao', 'mocao', 'outro']),
      status: z.enum(['rascunho', 'protocolado', 'tramitando', 'aprovado', 'rejeitado', 'arquivado']).default('rascunho'),
      dataProtocolo: z.string().datetime({ offset: true }).optional(),
      temas: z.array(z.string()).default([]),
      linkOficial: z.string().url().optional(),
    }).parse(req.body)

    const projeto = await prisma.projetoLei.create({
      data: {
        candidateId, ...data,
        ...(data.dataProtocolo ? { dataProtocolo: new Date(data.dataProtocolo) } : {}),
      },
    })
    await auditLog({ candidateId, eventType: 'projeto_lei_criado', metadata: { id: projeto.id, tipo: data.tipo } })
    return reply.status(201).send(projeto)
  })

  app.patch('/gabinete/projetos/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const existing = await prisma.projetoLei.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })

    const data = z.object({
      numero: z.string().optional().nullable(),
      titulo: z.string().optional(),
      ementa: z.string().optional(),
      status: z.enum(['rascunho', 'protocolado', 'tramitando', 'aprovado', 'rejeitado', 'arquivado']).optional(),
      dataProtocolo: z.string().optional().nullable(),
      dataVotacao: z.string().optional().nullable(),
      resultado: z.string().optional().nullable(),
      linkOficial: z.string().url().optional().nullable(),
      temas: z.array(z.string()).optional(),
    }).parse(req.body)

    const updated = await prisma.projetoLei.update({
      where: { id },
      data: {
        ...data,
        ...(data.dataProtocolo ? { dataProtocolo: new Date(data.dataProtocolo) } : data.dataProtocolo === null ? { dataProtocolo: null } : {}),
        ...(data.dataVotacao ? { dataVotacao: new Date(data.dataVotacao) } : data.dataVotacao === null ? { dataVotacao: null } : {}),
      },
    })
    return reply.send(updated)
  })

  app.delete('/gabinete/projetos/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const existing = await prisma.projetoLei.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })
    await prisma.projetoLei.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── PROTOCOLOS DE ATENDIMENTO ───────────────────────────────────────────────

  app.get('/gabinete/protocolos', { onRequest: [requireModule('contacts')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { status, page, q } = req.query as { status?: string; page?: string; q?: string }
    const pageNum = Math.max(1, parseInt(page ?? '1', 10))
    const take = 20

    const where: Record<string, unknown> = { candidateId }
    if (status) where.status = status
    if (q) where.solicitante = { contains: q, mode: 'insensitive' }

    const [items, total] = await Promise.all([
      prisma.protocoloAtendimento.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip: (pageNum - 1) * take }),
      prisma.protocoloAtendimento.count({ where }),
    ])
    return reply.send({ items, total, page: pageNum, pages: Math.ceil(total / take) })
  })

  app.post('/gabinete/protocolos', { onRequest: [requireModule('contacts')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = z.object({
      solicitante: z.string().min(2).max(200),
      telefone: z.string().optional(),
      assunto: z.string().min(2).max(500),
      descricao: z.string().optional(),
      prioridade: z.enum(['normal', 'alta', 'urgente']).default('normal'),
      responsavel: z.string().optional(),
      prazo: z.string().datetime({ offset: true }).optional(),
    }).parse(req.body)

    const numero = gerarNumeroProtocolo()
    const protocolo = await prisma.protocoloAtendimento.create({
      data: {
        candidateId, numero, ...data,
        ...(data.prazo ? { prazo: new Date(data.prazo) } : {}),
      },
    })
    await auditLog({ candidateId, eventType: 'protocolo_criado', metadata: { id: protocolo.id, numero } })
    return reply.status(201).send(protocolo)
  })

  app.patch('/gabinete/protocolos/:id', { onRequest: [requireModule('contacts')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const existing = await prisma.protocoloAtendimento.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })

    const data = z.object({
      status: z.enum(['aberto', 'em_andamento', 'resolvido', 'arquivado']).optional(),
      prioridade: z.enum(['normal', 'alta', 'urgente']).optional(),
      responsavel: z.string().optional().nullable(),
      resposta: z.string().optional().nullable(),
      prazo: z.string().optional().nullable(),
      descricao: z.string().optional().nullable(),
    }).parse(req.body)

    const resolvidoEm = data.status === 'resolvido' && existing.status !== 'resolvido' ? new Date() : undefined

    const updated = await prisma.protocoloAtendimento.update({
      where: { id },
      data: {
        ...data,
        ...(resolvidoEm ? { resolvidoEm } : {}),
        ...(data.prazo ? { prazo: new Date(data.prazo) } : data.prazo === null ? { prazo: null } : {}),
      },
    })
    return reply.send(updated)
  })

  // GET /gabinete/resumo — dashboard com contagens
  app.get('/gabinete/resumo', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const hoje = new Date()
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const fim7dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [
      audienciasHoje, audienciasSemana, audienciasUrgentes,
      protocolosAbertos, protocolosUrgentes, projetosTramitando,
    ] = await Promise.all([
      prisma.audiencia.count({ where: { candidateId, status: 'agendada', dataHora: { gte: inicioDia, lt: new Date(inicioDia.getTime() + 86400000) } } }),
      prisma.audiencia.count({ where: { candidateId, status: 'agendada', dataHora: { gte: hoje, lte: fim7dias } } }),
      prisma.audiencia.count({ where: { candidateId, prioridade: 'urgente', status: { not: 'cancelada' } } }),
      prisma.protocoloAtendimento.count({ where: { candidateId, status: { in: ['aberto', 'em_andamento'] } } }),
      prisma.protocoloAtendimento.count({ where: { candidateId, prioridade: 'urgente', status: { in: ['aberto', 'em_andamento'] } } }),
      prisma.projetoLei.count({ where: { candidateId, status: 'tramitando' } }),
    ])

    return reply.send({ audienciasHoje, audienciasSemana, audienciasUrgentes, protocolosAbertos, protocolosUrgentes, projetosTramitando })
  })
}
