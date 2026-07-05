import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule } from '../../lib/rbac'
import { sendEmail, teamInviteEmail } from '../../lib/mailer'
import { startOfWeek, endOfWeek, subDays, startOfDay } from 'date-fns'

export async function lideresRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── VISÃO GERAL / RANKING ──────────────────────────────────────────────────

  // GET /lideres/ranking — ranking de líderes por score, votos comprometidos, atividade
  app.get('/lideres/ranking', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { funcao, supervisorId, bairro } = req.query as {
      funcao?: string
      supervisorId?: string
      bairro?: string
    }

    const where: any = {
      candidateId,
      status: 'ativo',
      ...(funcao && { funcao }),
      ...(supervisorId && { supervisorId }),
      ...(bairro && { bairros: { has: bairro } }),
    }

    const lideres = await prisma.colaboradorCampanha.findMany({
      where,
      orderBy: [{ scoreAtividade: 'desc' }, { votosComprometidos: 'desc' }],
      include: {
        supervisor: { select: { id: true, nome: true, funcao: true } },
        _count: { select: { subordinados: true, atividades: true } },
      },
    })

    // Alertas: líderes sem atividade nos últimos 7 dias
    const limiteAlerta = subDays(new Date(), 7)
    const alertas = lideres
      .filter(l => !l.ultimaAtividade || l.ultimaAtividade < limiteAlerta)
      .map(l => l.id)

    return reply.send({ lideres, alertas })
  })

  // GET /lideres/stats — totais consolidados para o painel
  app.get('/lideres/stats', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const [totalLideres, totalVotosComprometidos, atividadesSemana, semSemana] =
      await Promise.all([
        prisma.colaboradorCampanha.count({
          where: { candidateId, status: 'ativo' },
        }),
        prisma.colaboradorCampanha.aggregate({
          where: { candidateId, status: 'ativo' },
          _sum: { votosComprometidos: true },
        }),
        prisma.atividadeLider.count({
          where: {
            candidateId,
            dataAtividade: {
              gte: startOfWeek(new Date(), { weekStartsOn: 1 }),
            },
          },
        }),
        prisma.colaboradorCampanha.count({
          where: {
            candidateId,
            status: 'ativo',
            OR: [
              { ultimaAtividade: null },
              { ultimaAtividade: { lt: subDays(new Date(), 7) } },
            ],
          },
        }),
      ])

    return reply.send({
      totalLideres,
      totalVotosComprometidos: totalVotosComprometidos._sum.votosComprometidos ?? 0,
      atividadesSemana,
      lidereSemAtividade: semSemana,
    })
  })

  // ── PERFIL DO LÍDER ───────────────────────────────────────────────────────

  // GET /lideres/:id — ficha completa do líder
  app.get('/lideres/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const lider = await prisma.colaboradorCampanha.findFirst({
      where: { id, candidateId },
      include: {
        supervisor: { select: { id: true, nome: true, funcao: true, telefone: true } },
        subordinados: {
          where: { status: 'ativo' },
          select: {
            id: true,
            nome: true,
            funcao: true,
            scoreAtividade: true,
            votosComprometidos: true,
            ultimaAtividade: true,
          },
        },
        atividades: {
          orderBy: { dataAtividade: 'desc' },
          take: 50,
        },
        metasSemana: {
          orderBy: { semanaInicio: 'desc' },
          take: 8,
        },
        pagamentos: {
          orderBy: { dataPagamento: 'desc' },
          take: 6,
        },
        _count: { select: { subordinados: true, atividades: true } },
      },
    })

    if (!lider) return reply.status(404).send({ error: 'Líder não encontrado' })

    // Pesquisas coletadas por este líder
    const pesquisasColetadas = await prisma.voteSurveyResponse.count({
      where: {
        candidateId,
        collectedById: lider.teamMemberId ?? undefined,
      },
    })

    return reply.send({ ...lider, pesquisasColetadas })
  })

  // POST /lideres — criar líder diretamente (sem passar pela Equipe)
  app.post('/lideres', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const body = z.object({
      nome: z.string().min(2).max(120),
      funcao: z.string().min(2).max(40).default('cabo_eleitoral'),
      funcaoCustom: z.string().max(60).optional(),
      telefone: z.string().max(20).optional(),
      email: z.string().email().optional(),
      cpf: z.string().max(14).optional(),
      bairros: z.array(z.string()).optional().default([]),
      metaVotos: z.number().int().min(0).optional(),
      supervisorId: z.string().optional(),
      observacao: z.string().max(500).optional(),
      enviarConvite: z.boolean().optional().default(false),
      emailConvite: z.string().email().optional(),
    }).parse(req.body)

    // supervisorId deve pertencer ao mesmo candidato
    if (body.supervisorId) {
      const sup = await prisma.colaboradorCampanha.findFirst({
        where: { id: body.supervisorId, candidateId },
      })
      if (!sup) return reply.status(400).send({ error: 'Supervisor não encontrado' })
    }

    const lider = await prisma.colaboradorCampanha.create({
      data: {
        candidateId,
        nome: body.nome,
        funcao: body.funcao,
        funcaoCustom: body.funcaoCustom ?? null,
        telefone: body.telefone ?? null,
        email: body.email ?? null,
        cpf: body.cpf ?? null,
        bairros: body.bairros ?? [],
        metaVotos: body.metaVotos ?? null,
        supervisorId: body.supervisorId ?? null,
        observacao: body.observacao ?? null,
        // Campos obrigatórios de RH — não usados no contexto de líderes
        dataInicio: new Date(),
        valorAcordado: 0,
        periodicidade: 'mensal',
        formaPagamento: 'pix',
        status: 'ativo',
        scoreAtividade: 0,
        votosComprometidos: 0,
        confiabilidade: 100,
      },
    })

    // Enviar convite de acesso como Agente de Campo
    let conviteEnviado = false
    if (body.enviarConvite && body.emailConvite) {
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { name: true },
      })

      const token = crypto.randomBytes(32).toString('hex')
      const emailConvite = body.emailConvite

      await prisma.teamMember.upsert({
        where: { candidateId_email: { candidateId, email: emailConvite } },
        update: {
          name: body.nome,
          whatsapp: body.telefone ?? '',
          role: 'AGENTE_CAMPO',
          inviteToken: token,
          status: 'PENDING',
          acceptedAt: null,
          invitedAt: new Date(),
        },
        create: {
          candidateId,
          name: body.nome,
          email: emailConvite,
          whatsapp: body.telefone ?? '',
          role: 'AGENTE_CAMPO',
          inviteToken: token,
        },
      })

      // Vincula o lider ao TeamMember pelo email (após aceite o teamMemberId será preenchido)
      const acceptUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`
      await sendEmail(
        emailConvite,
        `Convite para a campanha de ${candidate?.name ?? 'candidato'} — SyncroFlowEleições`,
        teamInviteEmail(candidate?.name ?? 'Administrador', candidate?.name ?? '', 'AGENTE_CAMPO', acceptUrl),
      )
      conviteEnviado = true
    }

    return reply.status(201).send({ ...lider, conviteEnviado })
  })

  // PATCH /lideres/:id — atualizar dados do líder
  app.patch('/lideres/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const body = z.object({
      nome: z.string().min(2).max(120).optional(),
      funcao: z.string().min(2).max(40).optional(),
      funcaoCustom: z.string().max(60).optional(),
      telefone: z.string().max(20).optional(),
      email: z.string().email().optional(),
      cpf: z.string().max(14).optional(),
      metaVotos: z.number().int().min(0).optional(),
      bairros: z.array(z.string()).optional(),
      supervisorId: z.string().nullable().optional(),
      observacao: z.string().optional(),
      status: z.enum(['ativo', 'inativo']).optional(),
    }).parse(req.body)

    const lider = await prisma.colaboradorCampanha.findFirst({
      where: { id, candidateId },
    })
    if (!lider) return reply.status(404).send({ error: 'Líder não encontrado' })

    const atualizado = await prisma.colaboradorCampanha.update({
      where: { id },
      data: body,
    })

    return reply.send(atualizado)
  })

  // DELETE /lideres/:id — remover líder
  app.delete('/lideres/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const lider = await prisma.colaboradorCampanha.findFirst({ where: { id, candidateId } })
    if (!lider) return reply.status(404).send({ error: 'Líder não encontrado' })

    await prisma.colaboradorCampanha.update({ where: { id }, data: { status: 'inativo' } })
    return reply.send({ ok: true })
  })

  // ── ATIVIDADES ──────────────────────────────────────────────────────────────

  // GET /lideres/:id/atividades — histórico de atividades
  app.get('/lideres/:id/atividades', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const { limit = '30', offset = '0' } = req.query as { limit?: string; offset?: string }

    const [atividades, total] = await Promise.all([
      prisma.atividadeLider.findMany({
        where: { colaboradorId: id, candidateId },
        orderBy: { dataAtividade: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.atividadeLider.count({ where: { colaboradorId: id, candidateId } }),
    ])

    return reply.send({ atividades, total })
  })

  // POST /lideres/:id/atividades — registrar atividade manual
  app.post('/lideres/:id/atividades', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const body = z.object({
      tipo: z.enum(['pesquisa_voto', 'check_in', 'evento', 'tarefa', 'contato', 'outro']),
      descricao: z.string().optional(),
      bairro: z.string().optional(),
      dataAtividade: z.string().optional(),
    }).parse(req.body)

    const lider = await prisma.colaboradorCampanha.findFirst({
      where: { id, candidateId },
    })
    if (!lider) return reply.status(404).send({ error: 'Líder não encontrado' })

    const PONTOS: Record<string, number> = {
      pesquisa_voto: 3,
      check_in: 2,
      evento: 4,
      tarefa: 2,
      contato: 1,
      outro: 1,
    }

    const dataAtividade = body.dataAtividade ? new Date(body.dataAtividade) : new Date()

    const atividade = await prisma.atividadeLider.create({
      data: {
        candidateId,
        colaboradorId: id,
        tipo: body.tipo,
        descricao: body.descricao,
        bairro: body.bairro,
        pontos: PONTOS[body.tipo],
        dataAtividade,
      },
    })

    // Recalcula score semanal e atualiza ultimaAtividade
    await recalcularScore(id, candidateId)

    return reply.status(201).send(atividade)
  })

  // ── METAS SEMANAIS ─────────────────────────────────────────────────────────

  // GET /lideres/:id/metas — metas do líder (semanas recentes)
  app.get('/lideres/:id/metas', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const metas = await prisma.metaSemanaLider.findMany({
      where: { colaboradorId: id, candidateId },
      orderBy: { semanaInicio: 'desc' },
      take: 8,
    })

    return reply.send(metas)
  })

  // PUT /lideres/:id/metas/:semana — criar/atualizar meta de uma semana
  app.put('/lideres/:id/metas/:semana', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id, semana } = req.params as { id: string; semana: string }

    const body = z.object({
      metaPesquisas: z.number().int().min(0).default(0),
      metaCheckIns: z.number().int().min(0).default(0),
      metaEventos: z.number().int().min(0).default(0),
      metaContatos: z.number().int().min(0).default(0),
    }).parse(req.body)

    const semanaInicio = startOfWeek(new Date(semana), { weekStartsOn: 1 })

    const meta = await prisma.metaSemanaLider.upsert({
      where: { colaboradorId_semanaInicio: { colaboradorId: id, semanaInicio } },
      create: {
        candidateId,
        colaboradorId: id,
        semanaInicio,
        ...body,
      },
      update: body,
    })

    return reply.send(meta)
  })

  // ── TERRITÓRIOS ────────────────────────────────────────────────────────────

  // GET /lideres/territorios — lista territórios
  app.get('/lideres/territorios', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const territorios = await prisma.territorio.findMany({
      where: { candidateId, ativo: true },
      orderBy: { nome: 'asc' },
    })

    // Para cada território, busca o responsável e calcula votos reais
    const resultado = await Promise.all(
      territorios.map(async t => {
        const responsavel = t.responsavelId
          ? await prisma.colaboradorCampanha.findUnique({
              where: { id: t.responsavelId },
              select: { id: true, nome: true, funcao: true, votosComprometidos: true, scoreAtividade: true },
            })
          : null

        const votosNoTerritorio = await prisma.colaboradorCampanha.aggregate({
          where: {
            candidateId,
            status: 'ativo',
            bairros: { hasSome: t.bairros },
          },
          _sum: { votosComprometidos: true },
        })

        return {
          ...t,
          responsavel,
          votosReais: votosNoTerritorio._sum.votosComprometidos ?? 0,
          percentualMeta: t.metaVotos > 0
            ? Math.round(((votosNoTerritorio._sum.votosComprometidos ?? 0) / t.metaVotos) * 100)
            : 0,
        }
      })
    )

    return reply.send(resultado)
  })

  // POST /lideres/territorios — criar território
  app.post('/lideres/territorios', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const body = z.object({
      nome: z.string().min(2),
      bairros: z.array(z.string()).min(1),
      metaVotos: z.number().int().min(0).default(0),
      responsavelId: z.string().optional(),
      observacao: z.string().optional(),
      cor: z.string().optional(),
    }).parse(req.body)

    const territorio = await prisma.territorio.create({
      data: { candidateId, ...body },
    })

    return reply.status(201).send(territorio)
  })

  // PATCH /lideres/territorios/:id — editar território
  app.patch('/lideres/territorios/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const body = z.object({
      nome: z.string().min(2).optional(),
      bairros: z.array(z.string()).optional(),
      metaVotos: z.number().int().min(0).optional(),
      responsavelId: z.string().nullable().optional(),
      observacao: z.string().optional(),
      cor: z.string().optional(),
      ativo: z.boolean().optional(),
    }).parse(req.body)

    const territorio = await prisma.territorio.findFirst({ where: { id, candidateId } })
    if (!territorio) return reply.status(404).send({ error: 'Território não encontrado' })

    const atualizado = await prisma.territorio.update({
      where: { id },
      data: body,
    })

    return reply.send(atualizado)
  })

  // DELETE /lideres/territorios/:id
  app.delete('/lideres/territorios/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const territorio = await prisma.territorio.findFirst({ where: { id, candidateId } })
    if (!territorio) return reply.status(404).send({ error: 'Território não encontrado' })

    await prisma.territorio.update({ where: { id }, data: { ativo: false } })

    return reply.status(204).send()
  })

  // ── HIERARQUIA ─────────────────────────────────────────────────────────────

  // GET /lideres/hierarquia — árvore completa de líderes em formato nested
  app.get('/lideres/hierarquia', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const todos = await prisma.colaboradorCampanha.findMany({
      where: { candidateId, status: 'ativo' },
      select: {
        id: true,
        nome: true,
        funcao: true,
        funcaoCustom: true,
        supervisorId: true,
        scoreAtividade: true,
        votosComprometidos: true,
        metaVotos: true,
        bairros: true,
        ultimaAtividade: true,
        confiabilidade: true,
        _count: { select: { subordinados: true } },
      },
      orderBy: { nome: 'asc' },
    })

    // Monta árvore: raízes (sem supervisor) + filhos
    const buildTree = (nodes: typeof todos, parentId: string | null): any[] => {
      return nodes
        .filter(n => n.supervisorId === parentId)
        .map(n => ({
          ...n,
          filhos: buildTree(nodes, n.id),
        }))
    }

    const arvore = buildTree(todos, null)

    return reply.send({ arvore, total: todos.length })
  })

  // ── ALERTAS ────────────────────────────────────────────────────────────────

  // GET /lideres/alertas — líderes inativos, metas em risco, etc.
  app.get('/lideres/alertas', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const semAtividadeHa7Dias = await prisma.colaboradorCampanha.findMany({
      where: {
        candidateId,
        status: 'ativo',
        OR: [
          { ultimaAtividade: null },
          { ultimaAtividade: { lt: subDays(new Date(), 7) } },
        ],
      },
      select: {
        id: true,
        nome: true,
        funcao: true,
        ultimaAtividade: true,
        supervisor: { select: { id: true, nome: true } },
      },
    })

    const metaEmRisco = await prisma.colaboradorCampanha.findMany({
      where: {
        candidateId,
        status: 'ativo',
        metaVotos: { gt: 0 },
      },
      select: {
        id: true,
        nome: true,
        funcao: true,
        metaVotos: true,
        votosComprometidos: true,
      },
    })

    const lideresMetaEmRisco = metaEmRisco.filter(
      l => (l.metaVotos ?? 0) > 0 && l.votosComprometidos < Math.floor((l.metaVotos ?? 0) * 0.5)
    )

    return reply.send({
      semAtividade: semAtividadeHa7Dias,
      metaEmRisco: lideresMetaEmRisco,
      total: semAtividadeHa7Dias.length + lideresMetaEmRisco.length,
    })
  })

  // ── RECALCULAR SCORE (interno, chamado após nova atividade) ────────────────
}

async function recalcularScore(colaboradorId: string, candidateId: string) {
  const semanaInicio = startOfWeek(new Date(), { weekStartsOn: 1 })

  const atividades = await prisma.atividadeLider.findMany({
    where: {
      colaboradorId,
      candidateId,
      dataAtividade: { gte: semanaInicio },
    },
  })

  const score = atividades.reduce((acc, a) => acc + a.pontos, 0)

  // Conta votos comprometidos via pesquisa de voto (collectedById)
  const lider = await prisma.colaboradorCampanha.findUnique({
    where: { id: colaboradorId },
    select: { teamMemberId: true },
  })

  let votosComprometidos = 0
  if (lider?.teamMemberId) {
    const pesquisas = await prisma.voteSurveyResponse.aggregate({
      where: {
        candidateId,
        collectedById: lider.teamMemberId,
        intention: 'APOIADOR',
      },
      _count: true,
    })
    votosComprometidos = pesquisas._count
  }

  await prisma.colaboradorCampanha.update({
    where: { id: colaboradorId },
    data: {
      scoreAtividade: score,
      votosComprometidos,
      ultimaAtividade: new Date(),
    },
  })

  // Atualiza real da meta da semana atual
  const tipoCount: Record<string, number> = {}
  for (const a of atividades) {
    tipoCount[a.tipo] = (tipoCount[a.tipo] ?? 0) + 1
  }

  await prisma.metaSemanaLider.upsert({
    where: {
      colaboradorId_semanaInicio: { colaboradorId, semanaInicio },
    },
    create: {
      candidateId,
      colaboradorId,
      semanaInicio,
      realPesquisas: tipoCount['pesquisa_voto'] ?? 0,
      realCheckIns: tipoCount['check_in'] ?? 0,
      realEventos: tipoCount['evento'] ?? 0,
      realContatos: tipoCount['contato'] ?? 0,
    },
    update: {
      realPesquisas: tipoCount['pesquisa_voto'] ?? 0,
      realCheckIns: tipoCount['check_in'] ?? 0,
      realEventos: tipoCount['evento'] ?? 0,
      realContatos: tipoCount['contato'] ?? 0,
    },
  })
}
