import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'

// Categorias de receita e despesa (alinhadas com TSE SPCE)
const CATEGORIAS_RECEITA = [
  'recursos_proprios', 'doacao_pessoa_fisica', 'transferencia_partido',
  'transferencia_comite', 'financiamento_coletivo', 'outros_receita',
]

const CATEGORIAS_DESPESA = [
  'pessoal', 'publicidade', 'producao_material', 'impulsionamento_digital',
  'combustivel_transporte', 'alimentacao', 'aluguel_espaco', 'equipamentos',
  'servicos_juridicos', 'doacao_outros_candidatos', 'outros_despesa',
]

// Mapeamento TSE para exportação SPCE
const TSE_MAP: Record<string, string> = {
  recursos_proprios: '1.01', doacao_pessoa_fisica: '1.02', transferencia_partido: '1.03',
  transferencia_comite: '1.04', financiamento_coletivo: '1.05', outros_receita: '1.99',
  pessoal: '2.01', publicidade: '2.02', producao_material: '2.03',
  impulsionamento_digital: '2.04', combustivel_transporte: '2.05', alimentacao: '2.06',
  aluguel_espaco: '2.07', equipamentos: '2.08', servicos_juridicos: '2.09',
  doacao_outros_candidatos: '2.10', outros_despesa: '2.99',
}

export async function financeiroRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /financeiro/categorias
  app.get('/financeiro/categorias', async (_req, reply) => {
    return reply.send({ receita: CATEGORIAS_RECEITA, despesa: CATEGORIAS_DESPESA })
  })

  // GET /financeiro/resumo — totais, saldo, progresso do orçamento
  app.get('/financeiro/resumo', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const [lancamentos, meta] = await Promise.all([
      prisma.lancamentoFinanceiro.findMany({
        where: { candidateId, status: { not: 'cancelado' } },
        select: { tipo: true, categoria: true, valor: true, data: true },
      }),
      prisma.metaOrcamento.findUnique({ where: { candidateId } }),
    ])

    const totalReceita = lancamentos
      .filter(l => l.tipo === 'receita')
      .reduce((acc, l) => acc + Number(l.valor), 0)
    const totalDespesa = lancamentos
      .filter(l => l.tipo === 'despesa')
      .reduce((acc, l) => acc + Number(l.valor), 0)
    const saldo = totalReceita - totalDespesa

    // Agrupamento por categoria
    const porCategoria: Record<string, { receita: number; despesa: number }> = {}
    for (const l of lancamentos) {
      if (!porCategoria[l.categoria]) porCategoria[l.categoria] = { receita: 0, despesa: 0 }
      porCategoria[l.categoria][l.tipo as 'receita' | 'despesa'] += Number(l.valor)
    }

    // Evolução mensal (últimos 6 meses)
    const agora = new Date()
    const meses: { mes: string; receita: number; despesa: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      const rec = lancamentos
        .filter(l => l.tipo === 'receita' && l.data >= d && l.data <= fim)
        .reduce((a, l) => a + Number(l.valor), 0)
      const des = lancamentos
        .filter(l => l.tipo === 'despesa' && l.data >= d && l.data <= fim)
        .reduce((a, l) => a + Number(l.valor), 0)
      meses.push({ mes: label, receita: rec, despesa: des })
    }

    const percentualGasto = meta?.totalPrevisto && Number(meta.totalPrevisto) > 0
      ? Math.round((totalDespesa / Number(meta.totalPrevisto)) * 100)
      : null

    return reply.send({
      totalReceita, totalDespesa, saldo, porCategoria, evolucaoMensal: meses,
      meta: meta ? { totalPrevisto: Number(meta.totalPrevisto), alertaPercentual: meta.alertaPercentual, percentualGasto } : null,
    })
  })

  // GET /financeiro — lista lançamentos com filtros
  app.get('/financeiro', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { tipo, categoria, status, dataInicio, dataFim, page, q } = req.query as {
      tipo?: string; categoria?: string; status?: string
      dataInicio?: string; dataFim?: string; page?: string; q?: string
    }
    const pageNum = Math.max(1, parseInt(page ?? '1', 10))
    const take = 25

    const where: Record<string, unknown> = { candidateId }
    if (tipo) where.tipo = tipo
    if (categoria) where.categoria = categoria
    if (status) where.status = status
    if (dataInicio || dataFim) {
      where.data = {
        ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
        ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59') } : {}),
      }
    }
    if (q) where.descricao = { contains: q, mode: 'insensitive' }

    const [items, total] = await Promise.all([
      prisma.lancamentoFinanceiro.findMany({
        where, orderBy: { data: 'desc' },
        take, skip: (pageNum - 1) * take,
      }),
      prisma.lancamentoFinanceiro.count({ where }),
    ])

    return reply.send({ items, total, page: pageNum, pages: Math.ceil(total / take) })
  })

  // POST /financeiro — criar lançamento
  app.post('/financeiro', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = z.object({
      tipo: z.enum(['receita', 'despesa']),
      categoria: z.string().min(1),
      descricao: z.string().min(2).max(300),
      valor: z.number().positive(),
      data: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      fornecedor: z.string().max(200).optional(),
      notaFiscal: z.string().max(100).optional(),
      comprovante: z.string().url().optional(),
      observacao: z.string().max(1000).optional(),
      status: z.enum(['confirmado', 'pendente', 'cancelado']).default('confirmado'),
    }).parse(req.body)

    const tseCategoria = TSE_MAP[data.categoria] ?? null
    const lancamento = await prisma.lancamentoFinanceiro.create({
      data: {
        candidateId,
        ...data,
        valor: data.valor,
        data: new Date(data.data),
        tseCategoria,
      },
    })

    await auditLog({ candidateId, eventType: 'lancamento_criado', metadata: { id: lancamento.id, tipo: data.tipo, valor: data.valor } })
    return reply.status(201).send(lancamento)
  })

  // PATCH /financeiro/:id
  app.patch('/financeiro/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const existing = await prisma.lancamentoFinanceiro.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })

    const data = z.object({
      descricao: z.string().optional(),
      valor: z.number().positive().optional(),
      data: z.string().optional(),
      fornecedor: z.string().optional().nullable(),
      notaFiscal: z.string().optional().nullable(),
      comprovante: z.string().url().optional().nullable(),
      observacao: z.string().optional().nullable(),
      status: z.enum(['confirmado', 'pendente', 'cancelado']).optional(),
      categoria: z.string().optional(),
    }).parse(req.body)

    const updated = await prisma.lancamentoFinanceiro.update({
      where: { id },
      data: {
        ...data,
        ...(data.data ? { data: new Date(data.data) } : {}),
        ...(data.categoria ? { tseCategoria: TSE_MAP[data.categoria] ?? null } : {}),
      },
    })
    return reply.send(updated)
  })

  // DELETE /financeiro/:id
  app.delete('/financeiro/:id', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const existing = await prisma.lancamentoFinanceiro.findFirst({ where: { id, candidateId } })
    if (!existing) return reply.status(404).send({ error: 'Não encontrado' })

    await prisma.lancamentoFinanceiro.delete({ where: { id } })
    await auditLog({ candidateId, eventType: 'lancamento_excluido', metadata: { id } })
    return reply.status(204).send()
  })

  // GET /financeiro/export — CSV para prestação de contas TSE
  app.get('/financeiro/export', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { dataInicio, dataFim } = req.query as { dataInicio?: string; dataFim?: string }

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: {
        candidateId,
        status: { not: 'cancelado' },
        ...(dataInicio || dataFim ? {
          data: {
            ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
            ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59') } : {}),
          },
        } : {}),
      },
      orderBy: { data: 'asc' },
    })

    const header = 'Tipo,Categoria,Codigo TSE,Descricao,Valor,Data,Fornecedor,Nota Fiscal,Status\n'
    const rows = lancamentos.map(l => [
      l.tipo, l.categoria, l.tseCategoria ?? '',
      `"${l.descricao.replace(/"/g, '""')}"`,
      Number(l.valor).toFixed(2).replace('.', ','),
      new Date(l.data).toLocaleDateString('pt-BR'),
      l.fornecedor ?? '', l.notaFiscal ?? '', l.status,
    ].join(','))

    const csv = '﻿' + header + rows.join('\n')
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="prestacao-contas.csv"')
    return reply.send(csv)
  })

  // GET /financeiro/orcamento — meta de orçamento
  app.get('/financeiro/orcamento', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const meta = await prisma.metaOrcamento.findUnique({ where: { candidateId } })
    return reply.send(meta ?? { totalPrevisto: 0, alertaPercentual: 80 })
  })

  // PUT /financeiro/orcamento — upsert da meta
  app.put('/financeiro/orcamento', { onRequest: [requireModule('reports')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { totalPrevisto, alertaPercentual } = z.object({
      totalPrevisto: z.number().min(0),
      alertaPercentual: z.number().min(1).max(100).default(80),
    }).parse(req.body)

    const meta = await prisma.metaOrcamento.upsert({
      where: { candidateId },
      create: { candidateId, totalPrevisto, alertaPercentual },
      update: { totalPrevisto, alertaPercentual },
    })
    return reply.send(meta)
  })
}
