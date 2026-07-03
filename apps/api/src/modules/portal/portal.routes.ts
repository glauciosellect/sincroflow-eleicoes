import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const portalConfigSchema = z.object({
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  titulo: z.string().min(3).max(120),
  subtitulo: z.string().max(200).optional(),
  descricao: z.string().max(2000).optional(),
  fotoUrl: z.string().url().optional().nullable(),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#002776'),
  ativo: z.boolean().default(true),
})

const cadastroSchema = z.object({
  nome: z.string().min(2).max(120),
  telefone: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
  cidade: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  assunto: z.string().max(200).optional(),
  mensagem: z.string().max(2000).optional(),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function portalPublicRoutes(app: FastifyInstance) {
  // GET /portal/p/:slug — página pública (sem auth)
  app.get('/portal/p/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }

    const portal = await prisma.portalEleitor.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        titulo: true,
        subtitulo: true,
        descricao: true,
        fotoUrl: true,
        corPrimaria: true,
        ativo: true,
        totalCadastros: true,
        candidate: {
          select: { name: true, position: true, party: true, state: true, city: true },
        },
      },
    })

    if (!portal || !portal.ativo) return reply.status(404).send({ error: 'Portal não encontrado ou inativo' })

    return reply.send(portal)
  })

  // POST /portal/p/:slug/cadastro — eleitor se cadastra (sem auth)
  app.post('/portal/p/:slug/cadastro', async (req, reply) => {
    const { slug } = req.params as { slug: string }

    const portal = await prisma.portalEleitor.findUnique({ where: { slug } })
    if (!portal || !portal.ativo) return reply.status(404).send({ error: 'Portal não encontrado ou inativo' })

    const data = cadastroSchema.parse(req.body)

    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
      ?? req.socket?.remoteAddress
      ?? undefined

    const cadastro = await prisma.cadastroPortal.create({
      data: {
        portalId: portal.id,
        origemIp: ip,
        ...data,
      },
    })

    await prisma.portalEleitor.update({
      where: { id: portal.id },
      data: { totalCadastros: { increment: 1 } },
    })

    // Gera protocolo automaticamente se o eleitor informou assunto ou mensagem
    if (data.assunto || data.mensagem) {
      const ano = new Date().getFullYear()
      const numero = `GAB-${ano}-${String(Date.now()).slice(-6)}`
      await prisma.protocoloAtendimento.create({
        data: {
          candidateId: portal.candidateId,
          numero,
          solicitante: data.nome,
          assunto: data.assunto ?? 'Solicitação via Portal',
          descricao: data.mensagem ?? undefined,
          prioridade: 'normal',
          status: 'aberto',
        },
      }).catch(() => {}) // não bloqueia o cadastro se o gabinete não estiver ativo
    }

    return reply.status(201).send({ id: cadastro.id, nome: cadastro.nome })
  })
}

export async function portalRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /portal — config atual do portal
  app.get('/portal', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const portal = await prisma.portalEleitor.findUnique({
      where: { candidateId },
    })

    return reply.send(portal ?? null)
  })

  // POST /portal — cria ou atualiza config
  app.post('/portal', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const data = portalConfigSchema.parse(req.body)

    // Verifica se slug já está em uso por outro candidato
    const slugConflict = await prisma.portalEleitor.findFirst({
      where: { slug: data.slug, candidateId: { not: candidateId } },
    })
    if (slugConflict) return reply.status(409).send({ error: 'Este slug já está em uso por outro portal.' })

    const portal = await prisma.portalEleitor.upsert({
      where: { candidateId },
      create: { candidateId, ...data },
      update: data,
    })

    await auditLog({ candidateId, eventType: 'portal_config_updated', metadata: { slug: data.slug } })

    return reply.status(201).send(portal)
  })

  // GET /portal/cadastros — lista cadastros com filtros
  app.get('/portal/cadastros', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { status, search, page } = req.query as {
      status?: string
      search?: string
      page?: string
    }

    const pageNum = Math.max(1, parseInt(page ?? '1', 10))
    const take = 50
    const skip = (pageNum - 1) * take

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId }, select: { id: true } })
    if (!portal) return reply.send({ items: [], total: 0 })

    const where = {
      portalId: portal.id,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { nome: { contains: search, mode: 'insensitive' as const } },
              { telefone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.cadastroPortal.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      prisma.cadastroPortal.count({ where }),
    ])

    return reply.send({ items, total, page: pageNum, pages: Math.ceil(total / take) })
  })

  // PATCH /portal/cadastros/:id — atualiza status
  app.patch('/portal/cadastros/:id', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }
    const { status } = z.object({ status: z.enum(['novo', 'contatado', 'convertido', 'spam']) }).parse(req.body)

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId }, select: { id: true } })
    if (!portal) return reply.status(404).send({ error: 'Portal não configurado' })

    const cadastro = await prisma.cadastroPortal.findFirst({ where: { id, portalId: portal.id } })
    if (!cadastro) return reply.status(404).send({ error: 'Cadastro não encontrado' })

    const updated = await prisma.cadastroPortal.update({ where: { id }, data: { status } })
    return reply.send(updated)
  })

  // DELETE /portal/cadastros/:id
  app.delete('/portal/cadastros/:id', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId }, select: { id: true } })
    if (!portal) return reply.status(404).send({ error: 'Portal não configurado' })

    const cadastro = await prisma.cadastroPortal.findFirst({ where: { id, portalId: portal.id } })
    if (!cadastro) return reply.status(404).send({ error: 'Cadastro não encontrado' })

    await prisma.cadastroPortal.delete({ where: { id } })
    return reply.status(204).send()
  })

  // GET /portal/cadastros/export — CSV download
  app.get('/portal/cadastros/export', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId }, select: { id: true, slug: true } })
    if (!portal) return reply.status(404).send({ error: 'Portal não configurado' })

    const cadastros = await prisma.cadastroPortal.findMany({
      where: { portalId: portal.id },
      orderBy: { createdAt: 'asc' },
    })

    const header = 'Nome,Telefone,Email,Cidade,Bairro,Assunto,Status,Data\n'
    const rows = cadastros.map(c =>
      [c.nome, c.telefone, c.email ?? '', c.cidade ?? '', c.bairro ?? '', c.assunto ?? '', c.status, c.createdAt.toISOString()].map(v => `"${v.replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="portal-${portal.slug}-${new Date().toISOString().slice(0, 10)}.csv"`)
    return reply.send('﻿' + header + rows)
  })

  // POST /portal/cadastros/:id/sync-contact — adiciona cadastro aos Contatos
  app.post('/portal/cadastros/:id/sync-contact', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId }, select: { id: true } })
    if (!portal) return reply.status(404).send({ error: 'Portal não configurado' })

    const cadastro = await prisma.cadastroPortal.findFirst({ where: { id, portalId: portal.id } })
    if (!cadastro) return reply.status(404).send({ error: 'Cadastro não encontrado' })

    if (cadastro.contactId) return reply.send({ contactId: cadastro.contactId, alreadySynced: true })

    // Garante que existe um canal PORTAL para este candidato
    let channel = await prisma.channel.findFirst({ where: { candidateId, type: 'PORTAL' } })
    if (!channel) {
      channel = await prisma.channel.create({
        data: { candidateId, type: 'PORTAL', name: 'Portal do Eleitor', isActive: true, config: {} },
      })
    }

    // Upsert contact pelo telefone
    const phone = cadastro.telefone.replace(/\D/g, '')
    const contact = await prisma.contact.upsert({
      where: { candidateId_channelId_externalId: { candidateId, channelId: channel.id, externalId: phone } },
      update: {
        name: cadastro.nome,
        email: cadastro.email ?? undefined,
        neighborhood: cadastro.bairro ?? undefined,
        lastContactAt: new Date(),
      },
      create: {
        candidateId, channelId: channel.id,
        externalId: phone, phone: cadastro.telefone,
        name: cadastro.nome, email: cadastro.email ?? undefined,
        neighborhood: cadastro.bairro ?? undefined,
        contactType: 'VOTER',
      },
    })

    await prisma.cadastroPortal.update({ where: { id }, data: { contactId: contact.id } })

    return reply.send({ contactId: contact.id, alreadySynced: false })
  })

  // POST /portal/cadastros/sync-all — sincroniza todos os cadastros de uma vez
  app.post('/portal/cadastros/sync-all', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId }, select: { id: true } })
    if (!portal) return reply.status(404).send({ error: 'Portal não configurado' })

    let channel = await prisma.channel.findFirst({ where: { candidateId, type: 'PORTAL' } })
    if (!channel) {
      channel = await prisma.channel.create({
        data: { candidateId, type: 'PORTAL', name: 'Portal do Eleitor', isActive: true, config: {} },
      })
    }

    const pendentes = await prisma.cadastroPortal.findMany({
      where: { portalId: portal.id, contactId: null },
    })

    let synced = 0
    for (const cadastro of pendentes) {
      try {
        const phone = cadastro.telefone.replace(/\D/g, '')
        const contact = await prisma.contact.upsert({
          where: { candidateId_channelId_externalId: { candidateId, channelId: channel.id, externalId: phone } },
          update: { name: cadastro.nome, email: cadastro.email ?? undefined, neighborhood: cadastro.bairro ?? undefined, lastContactAt: new Date() },
          create: { candidateId, channelId: channel.id, externalId: phone, phone: cadastro.telefone, name: cadastro.nome, email: cadastro.email ?? undefined, neighborhood: cadastro.bairro ?? undefined, contactType: 'VOTER' },
        })
        await prisma.cadastroPortal.update({ where: { id: cadastro.id }, data: { contactId: contact.id } })
        synced++
      } catch { /* ignora duplicata */ }
    }

    return reply.send({ synced, total: pendentes.length })
  })
}
