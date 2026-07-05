import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'
import { sendEmail, teamInviteEmail } from '../../lib/mailer'

function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11 || /^(\d)\1{10}$/.test(nums)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += parseInt(nums[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r >= 10 ? 0 : r
  }
  return calc(9) === parseInt(nums[9]) && calc(10) === parseInt(nums[10])
}

const cpfValido = z.string().min(11).max(14).refine(
  v => validarCPF(v),
  { message: 'CPF inválido' }
)

const FUNCOES: Record<string, string> = {
  cabo_eleitoral: 'Cabo Eleitoral',
  coordenador: 'Coordenador',
  motorista: 'Motorista',
  assessor: 'Assessor',
  mesario: 'Mesário',
  fotografo: 'Fotógrafo/Videomaker',
  social_media: 'Social Media',
  advogado: 'Advogado Eleitoral',
  contador: 'Contador',
  outro: 'Outro',
}

export async function equipeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── COLABORADORES ──────────────────────────────────────────────────────────

  // GET /equipe — lista colaboradores
  app.get('/equipe', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { status, funcao, supervisorId } = req.query as { status?: string; funcao?: string; supervisorId?: string }

    // Coordenador vê apenas subordinados diretos e deles em diante
    // Admin/candidato vê todos — identificamos pelo teamMemberId vinculado ao sub
    let coordColaboradorId: string | undefined
    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: sub, candidateId, status: 'ACTIVE' },
      select: { role: true, colaboradorVinculo: { select: { id: true } } },
    })
    if (teamMember?.role === 'COORDENADOR' && teamMember.colaboradorVinculo?.id) {
      coordColaboradorId = teamMember.colaboradorVinculo.id
    }

    // Coleta IDs da árvore abaixo do coordenador (até 3 níveis)
    let allowedIds: string[] | undefined
    if (coordColaboradorId) {
      const nivel1 = await prisma.colaboradorCampanha.findMany({
        where: { supervisorId: coordColaboradorId, candidateId },
        select: { id: true },
      })
      const ids1 = nivel1.map(c => c.id)
      const nivel2 = ids1.length ? await prisma.colaboradorCampanha.findMany({
        where: { supervisorId: { in: ids1 }, candidateId },
        select: { id: true },
      }) : []
      const ids2 = nivel2.map(c => c.id)
      allowedIds = [coordColaboradorId, ...ids1, ...ids2]
    }

    const colaboradores = await prisma.colaboradorCampanha.findMany({
      where: {
        candidateId,
        ...(allowedIds ? { id: { in: allowedIds } } : {}),
        ...(status ? { status } : {}),
        ...(funcao ? { funcao } : {}),
        ...(supervisorId ? { supervisorId } : {}),
      },
      include: {
        _count: { select: { pagamentos: true } },
        pagamentos: {
          orderBy: { dataPagamento: 'desc' },
          take: 1,
          select: { valor: true, dataPagamento: true, competencia: true },
        },
        teamMember: { select: { id: true, email: true, role: true, status: true } },
        supervisor: { select: { id: true, nome: true, funcao: true } },
      },
      orderBy: { nome: 'asc' },
    })

    // Totais por status
    const todos = await prisma.colaboradorCampanha.findMany({
      where: { candidateId },
      select: { status: true, valorAcordado: true, periodicidade: true },
    })
    const ativos = todos.filter(c => c.status === 'ativo')
    const totalMensalAtivos = ativos
      .filter(c => c.periodicidade === 'mensal')
      .reduce((s, c) => s + Number(c.valorAcordado), 0)

    return reply.send({
      colaboradores,
      resumo: {
        total: todos.length,
        ativos: ativos.length,
        inativos: todos.filter(c => c.status !== 'ativo').length,
        totalMensalAtivos,
      },
      funcoes: FUNCOES,
    })
  })

  // POST /equipe — cadastrar colaborador
  app.post('/equipe', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = z.object({
      nome: z.string().min(2).max(200),
      cpf: cpfValido,
      funcao: z.enum(['cabo_eleitoral','coordenador','motorista','assessor','mesario','fotografo','social_media','advogado','contador','outro']),
      funcaoCustom: z.string().max(100).optional(),
      telefone: z.string().max(20).optional(),
      email: z.string().email().optional().or(z.literal('')),
      dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      valorAcordado: z.number().positive(),
      periodicidade: z.enum(['diario','semanal','quinzenal','mensal','fixo']).default('mensal'),
      formaPagamento: z.enum(['pix','transferencia','cheque','dinheiro']).default('pix'),
      observacao: z.string().max(1000).optional(),
      supervisorId: z.string().optional(),
      acesso: z.object({
        ativo: z.boolean(),
        role: z.enum(['ADMINISTRADOR','ATENDIMENTO','CONTEUDO','RELATORIOS','AGENTE_CAMPO','COORDENADOR']).optional(),
        email: z.string().email().optional(),
        whatsapp: z.string().max(20).optional(),
      }).optional(),
    }).parse(req.body)

    const { acesso, ...colabData } = data

    const colaborador = await prisma.colaboradorCampanha.create({
      data: {
        candidateId,
        ...colabData,
        email: colabData.email || undefined,
        dataInicio: new Date(colabData.dataInicio),
        dataFim: colabData.dataFim ? new Date(colabData.dataFim) : undefined,
      },
    })

    // Se acesso ao Flow solicitado, criar TeamMember e enviar convite
    if (acesso?.ativo && acesso.email && acesso.role) {
      const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { name: true } })
      const inviter = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } })
      const token = crypto.randomBytes(32).toString('hex')

      const teamMember = await prisma.teamMember.upsert({
        where: { candidateId_email: { candidateId, email: acesso.email } },
        update: { name: data.nome, whatsapp: acesso.whatsapp ?? '', role: acesso.role, inviteToken: token, status: 'PENDING', acceptedAt: null, invitedAt: new Date() },
        create: { candidateId, name: data.nome, email: acesso.email, whatsapp: acesso.whatsapp ?? '', role: acesso.role, inviteToken: token },
      })

      await prisma.colaboradorCampanha.update({
        where: { id: colaborador.id },
        data: { teamMemberId: teamMember.id },
      })

      const acceptUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`
      await sendEmail(
        acesso.email,
        `Convite para a campanha de ${candidate?.name} — SyncroFlowEleições`,
        teamInviteEmail(inviter?.name ?? 'Alguém', candidate?.name ?? '', acesso.role, acceptUrl),
      ).catch(() => {})
    }

    await auditLog({ candidateId, eventType: 'colaborador_criado', metadata: { id: colaborador.id, nome: data.nome } })
    return reply.status(201).send(colaborador)
  })

  // PATCH /equipe/:id — editar colaborador
  app.patch('/equipe/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const existing = await prisma.colaboradorCampanha.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })

    const data = z.object({
      nome: z.string().min(2).max(200).optional(),
      cpf: cpfValido.optional(),
      funcao: z.string().optional(),
      funcaoCustom: z.string().optional().nullable(),
      telefone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional().nullable(),
      valorAcordado: z.number().positive().optional(),
      periodicidade: z.string().optional(),
      formaPagamento: z.string().optional(),
      observacao: z.string().optional().nullable(),
      status: z.enum(['ativo','inativo','encerrado']).optional(),
      supervisorId: z.string().optional().nullable(),
      acesso: z.object({
        ativo: z.boolean(),
        role: z.enum(['ADMINISTRADOR','ATENDIMENTO','CONTEUDO','RELATORIOS','AGENTE_CAMPO','COORDENADOR']).optional(),
        email: z.string().email().optional(),
        whatsapp: z.string().max(20).optional(),
      }).optional(),
    }).parse(req.body)

    const { acesso, ...colabData } = data

    const updated = await prisma.colaboradorCampanha.update({
      where: { id },
      data: {
        ...colabData,
        ...(colabData.dataInicio ? { dataInicio: new Date(colabData.dataInicio) } : {}),
        ...(colabData.dataFim !== undefined ? { dataFim: colabData.dataFim ? new Date(colabData.dataFim) : null } : {}),
      },
    })

    // Se acesso alterado para ativo e email fornecido, criar/reenviar convite
    if (acesso?.ativo && acesso.email && acesso.role) {
      const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { name: true } })
      const inviter = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } })
      const token = crypto.randomBytes(32).toString('hex')
      const nome = data.nome ?? existing.nome

      const teamMember = await prisma.teamMember.upsert({
        where: { candidateId_email: { candidateId, email: acesso.email } },
        update: { name: nome, whatsapp: acesso.whatsapp ?? '', role: acesso.role, inviteToken: token, status: 'PENDING', acceptedAt: null, invitedAt: new Date() },
        create: { candidateId, name: nome, email: acesso.email, whatsapp: acesso.whatsapp ?? '', role: acesso.role, inviteToken: token },
      })

      await prisma.colaboradorCampanha.update({
        where: { id },
        data: { teamMemberId: teamMember.id },
      })

      const acceptUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`
      await sendEmail(
        acesso.email,
        `Convite para a campanha de ${candidate?.name} — SyncroFlowEleições`,
        teamInviteEmail(inviter?.name ?? 'Alguém', candidate?.name ?? '', acesso.role, acceptUrl),
      ).catch(() => {})
    } else if (acesso && !acesso.ativo && existing.teamMemberId) {
      // Remover acesso ao Flow (não deleta TeamMember, apenas desvincula)
      await prisma.colaboradorCampanha.update({ where: { id }, data: { teamMemberId: null } })
    }

    return reply.send(updated)
  })

  // DELETE /equipe/:id
  app.delete('/equipe/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const existing = await prisma.colaboradorCampanha.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })

    await prisma.colaboradorCampanha.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── PAGAMENTOS ─────────────────────────────────────────────────────────────

  // GET /equipe/:id/pagamentos
  app.get('/equipe/:id/pagamentos', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const colaborador = await prisma.colaboradorCampanha.findFirst({ where: { id, candidateId } })
    if (!colaborador) return reply.status(404).send({ error: 'Não encontrado' })

    const pagamentos = await prisma.pagamentoColaborador.findMany({
      where: { colaboradorId: id },
      orderBy: { dataPagamento: 'desc' },
    })

    const totalPago = pagamentos.reduce((s, p) => s + Number(p.valor), 0)
    return reply.send({ pagamentos, totalPago, colaborador })
  })

  // POST /equipe/:id/pagamentos — registrar pagamento e criar lançamento financeiro
  app.post('/equipe/:id/pagamentos', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const colaborador = await prisma.colaboradorCampanha.findFirst({ where: { id, candidateId } })
    if (!colaborador) return reply.status(404).send({ error: 'Não encontrado' })

    const data = z.object({
      valor: z.number().positive(),
      dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      competencia: z.string().max(7).optional(), // "07/2026"
      formaPagamento: z.enum(['pix','transferencia','cheque','dinheiro']).default('pix'),
      comprovante: z.string().url().optional().or(z.literal('')),
      observacao: z.string().max(500).optional(),
    }).parse(req.body)

    // Cria lançamento financeiro automaticamente na categoria pessoal
    const lancamento = await prisma.lancamentoFinanceiro.create({
      data: {
        candidateId,
        tipo: 'despesa',
        categoria: 'pessoal',
        descricao: `Pagamento — ${colaborador.nome} (${FUNCOES[colaborador.funcao] ?? colaborador.funcao})${data.competencia ? ` — ${data.competencia}` : ''}`,
        valor: data.valor,
        data: new Date(data.dataPagamento),
        fornecedor: colaborador.nome,
        observacao: data.observacao,
        tseCategoria: '2.01',
        status: 'confirmado',
      },
    })

    const pagamento = await prisma.pagamentoColaborador.create({
      data: {
        candidateId,
        colaboradorId: id,
        valor: data.valor,
        dataPagamento: new Date(data.dataPagamento),
        competencia: data.competencia,
        formaPagamento: data.formaPagamento,
        comprovante: data.comprovante || undefined,
        observacao: data.observacao,
        lancamentoId: lancamento.id,
      },
    })

    return reply.status(201).send(pagamento)
  })

  // DELETE /equipe/pagamentos/:pagamentoId
  app.delete('/equipe/pagamentos/:pagamentoId', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { pagamentoId } = req.params as { pagamentoId: string }

    const pagamento = await prisma.pagamentoColaborador.findFirst({ where: { id: pagamentoId, candidateId } })
    if (!pagamento) return reply.status(404).send({ error: 'Não encontrado' })

    // Remove lançamento financeiro vinculado também
    if (pagamento.lancamentoId) {
      await prisma.lancamentoFinanceiro.deleteMany({ where: { id: pagamento.lancamentoId, candidateId } })
    }

    await prisma.pagamentoColaborador.delete({ where: { id: pagamentoId } })
    return reply.status(204).send()
  })

  // GET /equipe/relatorio-tse — lista para prestação de contas (nome + CPF + total pago)
  app.get('/equipe/relatorio-tse', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { dataInicio, dataFim } = req.query as { dataInicio?: string; dataFim?: string }

    const where: Record<string, unknown> = { candidateId }
    if (dataInicio || dataFim) {
      where.dataPagamento = {
        ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
        ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59') } : {}),
      }
    }

    const pagamentos = await prisma.pagamentoColaborador.findMany({
      where,
      include: { colaborador: { select: { nome: true, cpf: true, funcao: true, funcaoCustom: true } } },
      orderBy: { dataPagamento: 'asc' },
    })

    // Agrupa por colaborador
    const porColaborador: Record<string, { nome: string; cpf: string; funcao: string; totalPago: number; pagamentos: number }> = {}
    for (const p of pagamentos) {
      const k = p.colaboradorId
      if (!porColaborador[k]) {
        porColaborador[k] = {
          nome: p.colaborador.nome,
          cpf: p.colaborador.cpf ?? '',
          funcao: FUNCOES[p.colaborador.funcao] ?? p.colaborador.funcaoCustom ?? p.colaborador.funcao,
          totalPago: 0,
          pagamentos: 0,
        }
      }
      porColaborador[k].totalPago += Number(p.valor)
      porColaborador[k].pagamentos++
    }

    const totalGeral = Object.values(porColaborador).reduce((s, c) => s + c.totalPago, 0)

    return reply.send({
      colaboradores: Object.values(porColaborador).sort((a, b) => b.totalPago - a.totalPago),
      totalGeral,
      totalColaboradores: Object.keys(porColaborador).length,
      periodo: { dataInicio: dataInicio ?? null, dataFim: dataFim ?? null },
    })
  })
}
