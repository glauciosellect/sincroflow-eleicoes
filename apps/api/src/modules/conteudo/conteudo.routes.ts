import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { requireModule, auditLog } from '../../lib/rbac'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TEMAS: Record<string, string> = {
  saude: 'Saúde', educacao: 'Educação', seguranca: 'Segurança Pública',
  infraestrutura: 'Infraestrutura', meio_ambiente: 'Meio Ambiente',
  emprego: 'Emprego e Economia', cultura: 'Cultura', esporte: 'Esporte',
  transporte: 'Transporte', assistencia_social: 'Assistência Social',
  tecnologia: 'Tecnologia e Inovação', juventude: 'Juventude',
  terceira_idade: 'Terceira Idade', mulheres: 'Direitos das Mulheres',
  lgbtqia: 'Direitos LGBTQIA+', personalizado: 'Tema Personalizado',
}

const LIMITES: Record<string, number> = {
  instagram: 2200, facebook: 63206, tiktok: 2200,
  telegram: 4096, linkedin: 3000, x: 280,
}

const TOM_LABEL: Record<string, string> = {
  formal: 'formal e institucional', proximo: 'próximo e acessível', emotivo: 'emotivo e inspirador',
}

type Plataforma = 'instagram' | 'facebook' | 'tiktok' | 'telegram' | 'linkedin' | 'x'
type Tom = 'formal' | 'proximo' | 'emotivo'

async function gerarPost(candidateId: string, tema: string, temaCustomizado: string | undefined, plataforma: Plataforma, tom: Tom) {
  const [candidate, agentConfig] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: candidateId }, select: { name: true, position: true, party: true, state: true } }),
    prisma.agentConfig.findUnique({ where: { candidateId }, select: { story: true } }),
  ])

  const temaLabel = tema === 'personalizado' && temaCustomizado ? temaCustomizado : (TEMAS[tema] ?? tema)
  const limite = LIMITES[plataforma] ?? 2200

  const systemPrompt = `Você é um especialista em comunicação política brasileira.
Crie um post autêntico para ${plataforma} sobre "${temaLabel}" para:
- Candidato: ${candidate?.name ?? 'Candidato'}
- Cargo: ${candidate?.position ?? 'não informado'}
- Partido: ${candidate?.party ?? 'não informado'}
- Estado: ${candidate?.state ?? 'Brasil'}
${agentConfig?.story ? `- Contexto: ${agentConfig.story.slice(0, 300)}` : ''}

Tom: ${TOM_LABEL[tom] ?? tom} | Limite: ${limite} caracteres

Regras: NÃO peça voto diretamente, NÃO ataque adversários, foque em propostas e conexão com o eleitor, linguagem adequada para ${plataforma}.
Para X: máximo ${limite} chars. Para Instagram/TikTok: emojis com moderação, parágrafos curtos.

Retorne SOMENTE JSON válido:
{"texto": "texto completo", "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Gere um post sobre "${temaLabel}" para ${plataforma}.` }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text
  let parsed: { texto: string; hashtags: string[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('IA retornou resposta inválida')
    parsed = JSON.parse(match[0])
  }

  return { parsed, tokens: message.usage.input_tokens + message.usage.output_tokens }
}

export async function conteudoRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // POST /conteudo/gerar
  app.post('/conteudo/gerar', { onRequest: [requireModule('platform')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { tema, temaCustomizado, plataforma, tom } = z.object({
      tema: z.string(),
      temaCustomizado: z.string().max(200).optional(),
      plataforma: z.enum(['instagram', 'facebook', 'tiktok', 'telegram', 'linkedin', 'x']),
      tom: z.enum(['formal', 'proximo', 'emotivo']).default('proximo'),
    }).parse(req.body)

    const { parsed, tokens } = await gerarPost(candidateId, tema, temaCustomizado, plataforma, tom).catch(() => {
      throw { statusCode: 500, message: 'IA retornou resposta inválida. Tente novamente.' }
    })

    const record = await prisma.conteudoIA.create({
      data: { candidateId, tema, temaCustomizado, plataforma, tom, textoGerado: parsed.texto, hashtags: parsed.hashtags ?? [], tokensUsados: tokens },
    })

    await auditLog({ candidateId, eventType: 'conteudo_gerado', metadata: { tema, plataforma, id: record.id } })
    return reply.status(201).send({ ...record, texto: parsed.texto, hashtags: parsed.hashtags })
  })

  // POST /conteudo/:id/regenerar
  app.post('/conteudo/:id/regenerar', { onRequest: [requireModule('platform')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const original = await prisma.conteudoIA.findFirst({ where: { id, candidateId } })
    if (!original) return reply.status(404).send({ error: 'Não encontrado' })

    const { parsed, tokens } = await gerarPost(
      candidateId,
      original.tema,
      original.temaCustomizado ?? undefined,
      original.plataforma as Plataforma,
      original.tom as Tom,
    ).catch(() => { throw { statusCode: 500, message: 'Erro ao regenerar. Tente novamente.' } })

    const updated = await prisma.conteudoIA.update({
      where: { id },
      data: { textoGerado: parsed.texto, hashtags: parsed.hashtags ?? [], status: 'rascunho', tokensUsados: tokens },
    })

    return reply.send({ ...updated, texto: parsed.texto, hashtags: parsed.hashtags })
  })

  // GET /conteudo
  app.get('/conteudo', { onRequest: [requireModule('platform')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { status, plataforma, page } = req.query as { status?: string; plataforma?: string; page?: string }
    const pageNum = Math.max(1, parseInt(page ?? '1', 10))
    const take = 20

    const where = {
      candidateId,
      ...(status ? { status } : {}),
      ...(plataforma ? { plataforma } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.conteudoIA.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip: (pageNum - 1) * take }),
      prisma.conteudoIA.count({ where }),
    ])

    return reply.send({ items, total, page: pageNum, pages: Math.ceil(total / take) })
  })

  // PATCH /conteudo/:id
  app.patch('/conteudo/:id', { onRequest: [requireModule('platform')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const data = z.object({
      textoGerado: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      status: z.enum(['rascunho', 'agendado', 'enviado', 'arquivado']).optional(),
      agendadoPara: z.string().datetime().optional().nullable(),
    }).parse(req.body)

    const record = await prisma.conteudoIA.findFirst({ where: { id, candidateId } })
    if (!record) return reply.status(404).send({ error: 'Não encontrado' })

    const updated = await prisma.conteudoIA.update({
      where: { id },
      data: {
        ...(data.textoGerado !== undefined && { textoGerado: data.textoGerado }),
        ...(data.hashtags !== undefined && { hashtags: data.hashtags }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.agendadoPara !== undefined && {
          agendadoPara: data.agendadoPara ? new Date(data.agendadoPara) : null,
          status: data.agendadoPara ? 'agendado' : 'rascunho',
        }),
      },
    })

    return reply.send(updated)
  })

  // DELETE /conteudo/:id
  app.delete('/conteudo/:id', { onRequest: [requireModule('platform')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const { id } = req.params as { id: string }

    const record = await prisma.conteudoIA.findFirst({ where: { id, candidateId, status: { not: 'enviado' } } })
    if (!record) return reply.status(404).send({ error: 'Não encontrado ou já enviado' })

    await prisma.conteudoIA.delete({ where: { id } })
    return reply.status(204).send()
  })

  // GET /conteudo/temas — lista temas disponíveis
  app.get('/conteudo/temas', { onRequest: [requireModule('platform')] }, async (_req, reply) => {
    return reply.send(
      Object.entries(TEMAS).map(([id, label]) => ({ id, label }))
    )
  })

  // POST /conteudo/discurso — gera discurso de palanque com contexto das propostas
  app.post('/conteudo/discurso', { onRequest: [requireModule('platform')] }, async (req, reply) => {
    try {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)

    const { temas, duracao, tom } = z.object({
      temas:   z.array(z.string()).min(1).max(6),
      duracao: z.enum(['10', '15', '20', '30']).default('15'),
      tom:     z.enum(['formal', 'proximo', 'emotivo']).default('emotivo'),
    }).parse(req.body)

    // Busca dados do candidato + propostas dos temas escolhidos
    const [candidate, agentConfig, platformTopics] = await Promise.all([
      prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { name: true, position: true, party: true, state: true, city: true },
      }),
      prisma.agentConfig.findUnique({
        where: { candidateId },
        select: { story: true },
      }),
      prisma.platformTopic.findMany({
        where: { candidateId, topicKey: { in: temas } },
        select: { topicKey: true, topicName: true, content: true },
      }),
    ])

    const duracaoMin = parseInt(duracao)
    const palavrasAlvo = Math.round(duracaoMin * 130) // ~130 palavras/minuto de discurso
    const temasLabels = temas.map(t => TEMAS[t] ?? t).join(', ')
    const tomLabel = TOM_LABEL[tom] ?? tom

    // Monta contexto das propostas para a IA
    const propostasCtx = platformTopics.length > 0
      ? platformTopics.map(t => `## ${t.topicName}\n${(t.content ?? '').slice(0, 800)}`).join('\n\n')
      : 'Nenhuma proposta específica cadastrada — use argumentos gerais baseados no cargo e perfil do candidato.'

    const historiaCtx = agentConfig?.story
      ? `\n\nHISTÓRIA E CONTEXTO DO CANDIDATO:\n${agentConfig.story.slice(0, 600)}`
      : ''

    const systemPrompt = `Você é um redator de discursos políticos brasileiro de elite, especialista em retórica, oratória e comunicação eleitoral.

CANDIDATO: ${candidate?.name ?? 'Candidato'}
CARGO: ${candidate?.position ?? 'não informado'}
PARTIDO: ${candidate?.party ?? 'não informado'}
LOCAL: ${candidate?.city ?? ''} - ${candidate?.state ?? 'Brasil'}
${historiaCtx}

PROPOSTAS DO CANDIDATO SOBRE OS TEMAS ESCOLHIDOS:
${propostasCtx}

INSTRUÇÕES DO DISCURSO:
- Tom: ${tomLabel}
- Duração alvo: ${duracaoMin} minutos (~${palavrasAlvo} palavras)
- Temas: ${temasLabels}
- É um discurso de PALANQUE: precisa ser falado, emocionante, com pausas marcadas, aplausos provocados
- Use técnicas de retórica: tricolon, anáfora, pergunta retórica, narrativa pessoal, chamada à ação
- Estruture com: abertura impactante → conexão com o povo → desenvolvimento por tema → clímax emocional → encerramento memorável
- PROIBIDO: ataques a adversários, promessas impossíveis, linguagem técnica fria
- OBRIGATÓRIO: mencionar o número eleitoral ao final, convocar para o voto

FORMATO DE SAÍDA — JSON válido:
{
  "titulo": "título do discurso",
  "duracao_estimada": "${duracaoMin} minutos",
  "secoes": [
    { "nome": "Abertura", "texto": "...", "dica": "dica de oratória para esta seção" },
    { "nome": "Tema X", "texto": "...", "dica": "..." },
    ...
    { "nome": "Encerramento", "texto": "...", "dica": "..." }
  ],
  "resumo_executivo": "3 frases-chave do discurso para memorização rápida"
}`

    let message: Awaited<ReturnType<typeof anthropic.messages.create>>
    try {
      message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Gere o discurso completo de palanque sobre: ${temasLabels}` }],
      })
    } catch (aiErr: any) {
      throw { statusCode: 502, message: `Erro ao contatar IA: ${aiErr?.message ?? 'desconhecido'}` }
    }

    const textBlock = message.content.find((b: any) => b.type === 'text') as { type: string; text: string } | undefined
    if (!textBlock?.text) {
      console.error('[discurso] content vazio ou sem bloco text:', JSON.stringify(message.content))
      throw { statusCode: 500, message: 'IA retornou resposta vazia — tente novamente' }
    }
    const raw = textBlock.text
    let parsed: { titulo: string; duracao_estimada: string; secoes: Array<{ nome: string; texto: string; dica: string }>; resumo_executivo: string }

    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw { statusCode: 500, message: 'IA retornou resposta inválida — tente novamente' }
      try {
        parsed = JSON.parse(match[0])
      } catch {
        throw { statusCode: 500, message: 'IA retornou JSON incompleto — tente novamente' }
      }
    }

    if (!parsed.secoes || !Array.isArray(parsed.secoes) || parsed.secoes.length === 0) {
      throw { statusCode: 500, message: 'IA não gerou seções no discurso — tente novamente' }
    }

    // Salva no histórico como conteúdo com plataforma "discurso"
    const textoCompleto = parsed.secoes.map(s => `## ${s.nome}\n\n${s.texto}`).join('\n\n---\n\n')
    let record: { id: string }
    try {
      record = await prisma.conteudoIA.create({
        data: {
          candidateId,
          tema: temas[0],
          temaCustomizado: temasLabels,
          plataforma: 'discurso',
          tom,
          textoGerado: textoCompleto,
          hashtags: [],
          tokensUsados: message.usage.input_tokens + message.usage.output_tokens,
        },
      })
    } catch (dbErr: any) {
      // Discurso gerado com sucesso, apenas falhou ao salvar — retorna sem id
      return reply.status(201).send({ id: null, ...parsed, textoCompleto })
    }

    return reply.status(201).send({ id: record.id, ...parsed, textoCompleto })
    } catch (err: any) {
      console.error('[discurso] ERRO CAPTURADO:', err)
      const statusCode = err?.statusCode ?? 500
      const message = err?.message ?? 'Erro interno ao gerar discurso'
      return reply.status(statusCode).send({ message, error: message })
    }
  })
}
