import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'

// Chave Pix salva como EnvVariable com key='PIX_KEY' — não depende de migration
async function getPixKey(candidateId: string): Promise<string | null> {
  const env = await prisma.envVariable.findFirst({
    where: { candidateId, key: 'PIX_KEY' },
    select: { value: true },
  }).catch(() => null)
  return env?.value ?? null
}

function gerarQRCodePayload(chavePix: string, valor: number, nome: string, cidade: string, txid: string): string {
  // EMV QR Code estático simplificado (BR Code / Pix)
  const nomedomain = nome.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 25).trim()
  const cidadeclean = cidade.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15).trim()
  const valorStr = valor.toFixed(2)
  const txidClean = txid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25)

  function emv(id: string, value: string) {
    const len = value.length.toString().padStart(2, '0')
    return `${id}${len}${value}`
  }

  const merchantAccountInfo = emv('00', 'BR.GOV.BCB.PIX') + emv('01', chavePix)
  const payload = [
    emv('00', '01'),                                    // payload format
    emv('26', merchantAccountInfo),                     // merchant account info
    emv('52', '0000'),                                   // MCC
    emv('53', '986'),                                    // BRL
    emv('54', valorStr),                                 // amount
    emv('58', 'BR'),                                     // country
    emv('59', nomedomain),                               // merchant name
    emv('60', cidadeclean),                              // city
    emv('62', emv('05', txidClean)),                    // reference
    '6304',                                              // CRC placeholder
  ].join('')

  // CRC16-CCITT
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
}

export async function doacoesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /doacoes/config — chave Pix + info do candidato
  app.get('/doacoes/config', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { name: true, city: true, state: true, party: true, position: true },
    })

    const pixKey = await getPixKey(candidateId)

    return reply.send({ candidate, pixKey, hasPixKey: !!pixKey })
  })

  // POST /doacoes/config/pix — salvar chave Pix
  app.post('/doacoes/config/pix', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { pixKey } = z.object({ pixKey: z.string().min(5) }).parse(req.body)

    const existing = await prisma.envVariable.findFirst({ where: { candidateId, key: 'PIX_KEY' } })
    if (existing) {
      await prisma.envVariable.update({ where: { id: existing.id }, data: { value: pixKey } })
    } else {
      await prisma.envVariable.create({ data: { candidateId, key: 'PIX_KEY', value: pixKey } })
    }

    await auditLog({ candidateId, eventType: 'doacoes_config_pix', metadata: { pixKey } })
    return reply.send({ ok: true })
  })

  // POST /doacoes/gerar — gera QR code + registra doação pendente
  app.post('/doacoes/gerar', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const body = z.object({
      valor: z.number().min(5).max(50000),
      doadorNome: z.string().min(2).max(100),
      doadorCpf: z.string().length(11),
      doadorTelefone: z.string().optional(),
      mensagem: z.string().max(200).optional(),
    }).parse(req.body)

    const pixKey = await getPixKey(candidateId)
    if (!pixKey) {
      return reply.code(400).send({ error: 'Chave Pix não configurada. Configure em Configurações > Doações.' })
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { name: true, city: true },
    })
    if (!candidate) return reply.code(404).send({ error: 'Candidato não encontrado' })

    const txid = `DOA${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const qrPayload = gerarQRCodePayload(pixKey, body.valor, candidate.name, candidate.city ?? 'Brasil', txid)

    // Registra como lançamento pendente
    const lancamento = await prisma.lancamentoFinanceiro.create({
      data: {
        candidateId,
        tipo: 'receita',
        categoria: 'doacao_pessoa_fisica',
        descricao: `Doação Pix — ${body.doadorNome}`,
        valor: body.valor,
        data: new Date(),
        doadorCpf: body.doadorCpf,
        observacao: body.mensagem ?? null,
        status: 'pendente',
        tseCategoria: '1.02',
      },
    })

    return reply.send({
      txid,
      lancamentoId: lancamento.id,
      qrPayload,
      valor: body.valor,
      doadorNome: body.doadorNome,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    })
  })

  // POST /doacoes/:id/confirmar — confirma pagamento recebido
  app.post('/doacoes/:id/confirmar', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id, candidateId, status: 'pendente' },
    })
    if (!lancamento) return reply.code(404).send({ error: 'Doação não encontrada ou já confirmada' })

    const atualizado = await prisma.lancamentoFinanceiro.update({
      where: { id },
      data: { status: 'confirmado' },
    })

    await auditLog({ candidateId, eventType: 'doacoes_confirmar', metadata: { id } })
    return reply.send({ ok: true, lancamento: atualizado })
  })

  // POST /doacoes/:id/cancelar
  app.post('/doacoes/:id/cancelar', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    await prisma.lancamentoFinanceiro.updateMany({
      where: { id, candidateId },
      data: { status: 'cancelado' },
    })

    return reply.send({ ok: true })
  })

  // GET /doacoes — lista doações (paginada)
  app.get('/doacoes', { onRequest: [requireModule('financeiro')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const query = req.query as { page?: string; status?: string; search?: string }
    const page = parseInt(query.page ?? '1')
    const take = 20
    const skip = (page - 1) * take

    const where: any = {
      candidateId,
      categoria: 'doacao_pessoa_fisica',
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? {
        OR: [
          { descricao: { contains: query.search, mode: 'insensitive' } },
          { doadorCpf: { contains: query.search } },
        ],
      } : {}),
    }

    const [doacoes, total] = await Promise.all([
      prisma.lancamentoFinanceiro.findMany({
        where, orderBy: { createdAt: 'desc' }, take, skip,
      }),
      prisma.lancamentoFinanceiro.count({ where }),
    ])

    // Totais
    const totais = await prisma.lancamentoFinanceiro.aggregate({
      where: { candidateId, categoria: 'doacao_pessoa_fisica', status: 'confirmado' },
      _sum: { valor: true },
      _count: true,
    })

    return reply.send({
      doacoes,
      total,
      pages: Math.ceil(total / take),
      page,
      totalArrecadado: Number(totais._sum.valor ?? 0),
      totalDoadoresConfirmados: totais._count,
    })
  })

  // GET /doacoes/resumo — cards do topo
  app.get('/doacoes/resumo', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const [confirmadas, pendentes, canceladas] = await Promise.all([
      prisma.lancamentoFinanceiro.aggregate({
        where: { candidateId, categoria: 'doacao_pessoa_fisica', status: 'confirmado' },
        _sum: { valor: true }, _count: true,
      }),
      prisma.lancamentoFinanceiro.aggregate({
        where: { candidateId, categoria: 'doacao_pessoa_fisica', status: 'pendente' },
        _sum: { valor: true }, _count: true,
      }),
      prisma.lancamentoFinanceiro.count({
        where: { candidateId, categoria: 'doacao_pessoa_fisica', status: 'cancelado' },
      }),
    ])

    // Evolução últimos 6 meses
    const agora = new Date()
    const evolucao = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const agg = await prisma.lancamentoFinanceiro.aggregate({
        where: {
          candidateId, categoria: 'doacao_pessoa_fisica', status: 'confirmado',
          data: { gte: d, lte: fim },
        },
        _sum: { valor: true }, _count: true,
      })
      evolucao.push({
        mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor: Number(agg._sum.valor ?? 0),
        count: agg._count,
      })
    }

    return reply.send({
      totalArrecadado: Number(confirmadas._sum.valor ?? 0),
      totalDoadores: confirmadas._count,
      pendente: { valor: Number(pendentes._sum.valor ?? 0), count: pendentes._count },
      canceladas,
      evolucao,
    })
  })

  // GET /doacoes/:id/recibo — gera recibo em texto
  app.get('/doacoes/:id/recibo', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const [doacao, candidate] = await Promise.all([
      prisma.lancamentoFinanceiro.findFirst({ where: { id, candidateId } }),
      prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { name: true, cpf: true, party: true, position: true, city: true, state: true },
      }),
    ])

    if (!doacao || !candidate) return reply.code(404).send({ error: 'Não encontrado' })

    const recibo = {
      numero: `REC-${doacao.id.slice(-8).toUpperCase()}`,
      emitidoEm: new Date().toLocaleString('pt-BR'),
      candidato: {
        nome: candidate.name,
        cpf: candidate.cpf,
        partido: candidate.party,
        cargo: candidate.position,
        municipio: `${candidate.city}/${candidate.state}`,
      },
      doacao: {
        valor: Number(doacao.valor),
        data: doacao.data.toLocaleDateString('pt-BR'),
        doadorCpf: doacao.doadorCpf,
        descricao: doacao.descricao,
        status: doacao.status,
        tseCategoria: '1.02 — Doação de pessoa física',
      },
      conformidade: 'Em conformidade com a Lei nº 9.504/97 e Resolução TSE nº 23.607/2019',
    }

    return reply.send({ recibo })
  })
}
