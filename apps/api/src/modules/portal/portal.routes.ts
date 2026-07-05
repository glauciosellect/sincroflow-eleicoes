import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'
import path from 'path'
import fs from 'fs'

const UPLOADS_DIR = path.join(process.env.UPLOADS_PATH || '/app/apps/api/uploads', 'portal')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// ─── Schemas ─────────────────────────────────────────────────────────────────

const trajetoriaItemSchema = z.object({
  ano: z.string().max(10),
  descricao: z.string().max(300),
})

const depoimentoItemSchema = z.object({
  texto: z.string().max(500),
  autor: z.string().max(100),
})

const portalConfigSchema = z.object({
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  titulo: z.string().min(3).max(120),
  subtitulo: z.string().max(200).optional(),
  descricao: z.string().max(2000).optional(),
  fotoUrl: z.string().url().optional().nullable(),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#002776'),
  corDestaque: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#C9A227'),
  numero: z.string().max(20).optional().nullable(),
  instagram: z.string().max(100).optional().nullable(),
  facebook: z.string().max(100).optional().nullable(),
  tiktok: z.string().max(100).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  trajetoria: z.array(trajetoriaItemSchema).max(10).optional().nullable(),
  depoimentos: z.array(depoimentoItemSchema).max(6).optional().nullable(),
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
        corDestaque: true,
        numero: true,
        instagram: true,
        facebook: true,
        tiktok: true,
        whatsapp: true,
        trajetoria: true,
        depoimentos: true,
        ativo: true,
        totalCadastros: true,
        candidate: {
          select: {
            name: true, position: true, party: true, state: true, city: true, photoUrl: true,
            agentConfig: { select: { story: true } },
            platformTopics: {
              select: { topicKey: true, topicName: true, content: true },
              where: { content: { not: null } },
              take: 6,
              orderBy: { topicKey: 'asc' },
            },
          },
        },
      },
    })

    if (!portal || !portal.ativo) return reply.status(404).send({ error: 'Portal não encontrado ou inativo' })

    // Foto: prioriza fotoUrl do portal, depois photoUrl do candidato
    const fotoFinal = portal.fotoUrl ?? portal.candidate.photoUrl ?? null

    return reply.send({
      ...portal,
      fotoUrl: fotoFinal,
      trajetoria: (portal.trajetoria as any[]) ?? [],
      depoimentos: (portal.depoimentos as any[]) ?? [],
      candidate: {
        name: portal.candidate.name,
        position: portal.candidate.position,
        party: portal.candidate.party,
        state: portal.candidate.state,
        city: portal.candidate.city,
        story: portal.candidate.agentConfig?.story ?? null,
        propostas: portal.candidate.platformTopics,
      },
    })
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

    const portalData = {
      ...data,
      trajetoria: data.trajetoria ?? Prisma.JsonNull,
      depoimentos: data.depoimentos ?? Prisma.JsonNull,
    }
    const portal = await prisma.portalEleitor.upsert({
      where: { candidateId },
      create: { candidateId, ...portalData },
      update: portalData,
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

  // POST /portal/upload/:tipo — upload de foto (hero | sobre)
  app.post('/portal/upload/:tipo', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { tipo } = req.params as { tipo: string }

    if (!['hero', 'sobre'].includes(tipo)) {
      return reply.status(400).send({ error: 'Tipo deve ser "hero" ou "sobre"' })
    }

    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Apenas imagens JPEG, PNG ou WebP são aceitas' })
    }

    const ext = data.mimetype === 'image/png' ? 'png' : data.mimetype === 'image/webp' ? 'webp' : 'jpg'
    const filename = `${candidateId}-${tipo}.${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)

    const buffer = await data.toBuffer()
    fs.writeFileSync(filepath, buffer)

    const apiBase = process.env.API_URL || 'https://api.syncrofloweleicoes.com.br'
    const url = `${apiBase}/uploads/portal/${filename}`

    // Atualiza apenas se já existir — não tenta criar portal com upsert
    // (evita falha quando migrations ainda não rodaram no servidor)
    const existing = await prisma.portalEleitor.findUnique({ where: { candidateId } })
    if (existing) {
      const updateData = tipo === 'hero' ? { fotoUrl: url } : { fotoSobre: url }
      await prisma.portalEleitor.update({ where: { candidateId }, data: updateData }).catch(() => {
        // fotoSobre pode não existir se migration 000005 ainda não rodou — salva só fotoUrl nesse caso
        if (tipo === 'sobre') return prisma.portalEleitor.update({ where: { candidateId }, data: { fotoUrl: url } })
      })
    }

    return reply.send({ url })
  })

  // DELETE /portal — remove o portal do candidato
  app.delete('/portal', { onRequest: [requireModule('portal')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const portal = await prisma.portalEleitor.findUnique({ where: { candidateId } })
    if (!portal) return reply.status(404).send({ error: 'Portal não encontrado' })

    // remove fotos do disco se existirem
    for (const tipo of ['hero', 'sobre']) {
      for (const ext of ['jpg', 'png', 'webp']) {
        const fp = path.join(UPLOADS_DIR, `${candidateId}-${tipo}.${ext}`)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      }
    }

    await prisma.portalEleitor.delete({ where: { candidateId } })
    return reply.status(204).send()
  })
}
