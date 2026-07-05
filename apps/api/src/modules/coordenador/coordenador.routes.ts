import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'
import { sendEmail } from '../../lib/mailer'

const APP_URL = process.env.FRONTEND_URL || 'https://app.syncrofloweleicoes.com.br'

function boasVindasCoordenadorEmail(nome: string, email: string, senha: string, candidateName: string): string {
  const loginUrl = `${APP_URL}/coordenador/login`
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#002776 0%,#009C3B 100%);padding:32px 24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">SyncroFlow<span style="color:#FFDF00">Eleições</span></h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">Plataforma de Gestão de Campanha</p>
        </div>
        <div style="padding:32px 24px">
          <h2 style="color:#002776;margin:0 0 16px">Olá, ${nome}! 👋</h2>
          <p style="color:#444;line-height:1.6">Você foi cadastrado como <strong>Coordenador de Campo</strong> na campanha de <strong>${candidateName}</strong>.</p>
          <p style="color:#444;line-height:1.6">Use as credenciais abaixo para acessar seu painel:</p>

          <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #009C3B">
            <p style="margin:0 0 8px;color:#666;font-size:13px">E-mail de acesso:</p>
            <p style="margin:0 0 16px;font-weight:bold;color:#002776;font-size:16px">${email}</p>
            <p style="margin:0 0 8px;color:#666;font-size:13px">Senha:</p>
            <p style="margin:0;font-weight:bold;color:#002776;font-size:16px;letter-spacing:2px">${senha}</p>
          </div>

          <div style="text-align:center;margin:28px 0">
            <a href="${loginUrl}" style="background:#009C3B;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block">
              Acessar Meu Painel
            </a>
          </div>

          <p style="color:#666;font-size:13px;text-align:center">
            Ou acesse diretamente:<br>
            <a href="${loginUrl}" style="color:#009C3B">${loginUrl}</a>
          </p>

          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#999;font-size:12px;text-align:center">
            Por segurança, recomendamos alterar sua senha no primeiro acesso.<br>
            Se tiver dúvidas, entre em contato com o responsável da campanha.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

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

    // Cria portal padrão automaticamente se não existir — permite cadastro pelo app do coordenador
    // mesmo sem o candidato ter configurado o Portal do Eleitor manualmente
    let portal = await prisma.portalEleitor.findUnique({ where: { candidateId: payload.candidateId } })
    if (!portal) {
      const candidate = await prisma.candidate.findUnique({ where: { id: payload.candidateId }, select: { name: true } })
      const slug = payload.candidateId.slice(-8)
      portal = await prisma.portalEleitor.create({
        data: { candidateId: payload.candidateId, slug, titulo: candidate?.name ?? 'Campanha', ativo: true },
      })
    }

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

    // Gera protocolo automaticamente se o coordenador informou assunto ou mensagem
    if (data.assunto || data.mensagem) {
      const ano = new Date().getFullYear()
      const numero = `GAB-${ano}-${String(Date.now()).slice(-6)}`
      await prisma.protocoloAtendimento.create({
        data: {
          candidateId: payload.candidateId,
          numero,
          solicitante: data.nome,
          assunto: data.assunto ?? 'Solicitação via App do Coordenador',
          descricao: data.mensagem ?? undefined,
          prioridade: 'normal',
          status: 'aberto',
        },
      }).catch(() => {})
    }

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

  // GET /coordenador/ranking — ranking de coordenadores da campanha por cadastros
  app.get('/coordenador/ranking', { onRequest: [requireCoordenador] }, async (req, reply) => {
    const payload = req.user as unknown as CoordenadorPayload

    const coordenadores = await prisma.coordenador.findMany({
      where: { candidateId: payload.candidateId, ativo: true },
      select: { id: true, nome: true, cidade: true, metaVotos: true },
    })

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId: payload.candidateId } })

    const ranking = await Promise.all(coordenadores.map(async (c) => {
      const cadastros = portal ? await prisma.cadastroPortal.count({
        where: {
          portalId: portal.id,
          ...(c.cidade ? { cidade: c.cidade } : {}),
        },
      }) : 0
      const checkins = await prisma.checkInLider.count({ where: { coordenadorId: c.id } })
      const pct = c.metaVotos && cadastros > 0 ? Math.min(100, Math.round((cadastros / c.metaVotos) * 100)) : 0
      return { id: c.id, nome: c.nome, cidade: c.cidade, cadastros, checkins, metaVotos: c.metaVotos, pct, isMe: c.id === payload.coordenadorId }
    }))

    ranking.sort((a, b) => b.cadastros - a.cadastros)
    return reply.send(ranking)
  })

  // GET /coordenador/pesquisas — resultados de intenção de voto da área do coordenador
  app.get('/coordenador/pesquisas', { onRequest: [requireCoordenador] }, async (req, reply) => {
    const payload = req.user as unknown as CoordenadorPayload

    const where = {
      candidateId: payload.candidateId,
      ...(payload.cidade ? { city: payload.cidade } : {}),
      ...(payload.bairros.length > 0 ? { neighborhood: { in: payload.bairros } } : {}),
    }

    const [total, porIntencao] = await Promise.all([
      prisma.voteSurveyResponse.count({ where }),
      prisma.voteSurveyResponse.groupBy({
        by: ['intention'],
        where,
        _count: { intention: true },
      }),
    ])

    const ultimas = await prisma.voteSurveyResponse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, voterName: true, intention: true, neighborhood: true, city: true, createdAt: true },
    })

    const intencoes = porIntencao.map(g => ({
      intencao: g.intention,
      total: g._count.intention,
      pct: total > 0 ? Math.round((g._count.intention / total) * 100) : 0,
    })).sort((a, b) => b.total - a.total)

    return reply.send({ total, intencoes, ultimas })
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

    // Envia email de boas-vindas com credenciais de acesso
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { name: true } })
    sendEmail(
      data.email,
      `Bem-vindo à campanha de ${candidate?.name ?? 'seu candidato'} — SyncroFlow Eleições`,
      boasVindasCoordenadorEmail(data.nome, data.email, data.senha, candidate?.name ?? '')
    ).catch(() => {}) // não bloqueia a resposta se o email falhar

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

  // GET /painel/coordenadores/dashboard — dashboard de supervisão com métricas de todos
  app.get('/painel/coordenadores/dashboard', { onRequest: [requireModule('equipe')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const coordenadores = await prisma.coordenador.findMany({
      where: { candidateId },
      select: {
        id: true, nome: true, cidade: true, bairros: true, metaVotos: true,
        ativo: true, ultimoAcesso: true, createdAt: true,
        _count: { select: { checkIns: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Para cada coordenador calcula cadastros no portal dentro do seu escopo
    const portalId = await prisma.portalEleitor.findUnique({
      where: { candidateId },
      select: { id: true },
    })

    const dados = await Promise.all(coordenadores.map(async coord => {
      const cadastros = portalId ? await prisma.cadastroPortal.count({
        where: {
          portalId: portalId.id,
          ...(coord.cidade ? { cidade: coord.cidade } : {}),
          ...(coord.bairros.length > 0 ? { bairro: { in: coord.bairros } } : {}),
        },
      }) : 0

      const cadastrosSemana = portalId ? await prisma.cadastroPortal.count({
        where: {
          portalId: portalId.id,
          ...(coord.cidade ? { cidade: coord.cidade } : {}),
          ...(coord.bairros.length > 0 ? { bairro: { in: coord.bairros } } : {}),
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }) : 0

      const metaPct = coord.metaVotos && cadastros > 0
        ? Math.min(100, Math.round((cadastros / coord.metaVotos) * 100))
        : 0

      const diasSemAcesso = coord.ultimoAcesso
        ? Math.floor((Date.now() - new Date(coord.ultimoAcesso).getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        id: coord.id,
        nome: coord.nome,
        cidade: coord.cidade,
        bairros: coord.bairros,
        metaVotos: coord.metaVotos,
        ativo: coord.ativo,
        ultimoAcesso: coord.ultimoAcesso,
        diasSemAcesso,
        checkIns: coord._count.checkIns,
        cadastros,
        cadastrosSemana,
        metaPct,
        status: !coord.ativo ? 'inativo' : diasSemAcesso !== null && diasSemAcesso > 7 ? 'alerta' : 'ok',
      }
    }))

    const totais = {
      coordenadores: coordenadores.length,
      ativos: coordenadores.filter(c => c.ativo).length,
      totalCadastros: dados.reduce((s, d) => s + d.cadastros, 0),
      cadastrosSemana: dados.reduce((s, d) => s + d.cadastrosSemana, 0),
      emAlerta: dados.filter(d => d.status === 'alerta').length,
    }

    return reply.send({ coordenadores: dados, totais })
  })
}
