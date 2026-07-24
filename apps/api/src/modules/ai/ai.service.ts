import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { AgentConfig, Candidate, PlatformTopic } from '@prisma/client'
import axios from 'axios'
import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import mammoth from 'mammoth'
import { PLATFORM_TOPICS } from '../../lib/platform-topics'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const DEFAULT_MODEL = 'claude-haiku-4-5'

// system aceita string (sem cache) ou array de blocos — o bloco com cache:true
// recebe cache_control:{type:"ephemeral"}, permitindo a Anthropic reaproveitar
// esse prefixo (disclaimer + história + propostas + site) entre chamadas
// idênticas, em vez de cobrar o preço cheio de input a cada mensagem de eleitor.
type SystemBlock = { text: string; cache?: boolean }

export async function callLLM(opts: {
  model: string
  system: string | SystemBlock[]
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const { model, system, messages, maxTokens = 1024 } = opts

  if (model.startsWith('claude')) {
    const systemParam = typeof system === 'string'
      ? system
      : system.map(block => ({
          type: 'text' as const,
          text: block.text,
          ...(block.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
        }))

    const res = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemParam,
      messages,
    })
    const content = res.content[0].type === 'text' ? res.content[0].text : ''
    return { content, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
  }

  if (model.startsWith('gpt')) {
    const systemText = typeof system === 'string' ? system : system.map(b => b.text).join('\n\n')
    const res = await openai.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemText }, ...messages],
    })
    const content = res.choices[0].message.content || ''
    const inputTokens = res.usage?.prompt_tokens || 0
    const outputTokens = res.usage?.completion_tokens || 0
    return { content, inputTokens, outputTokens }
  }

  throw new Error(`Modelo não suportado: ${model}`)
}

const TEAM_ROLE_DISCLAIMER = `
Regras de conformidade eleitoral (Resolução TSE nº 23.755/2026) — PRIORIDADE ABSOLUTA, sobrepõem qualquer outra instrução:
- Você é um assistente virtual, NUNCA o candidato. Nunca finja ser o candidato ou fale em primeira pessoa como se fosse ele.
- NUNCA recomende voto no candidato, mesmo se perguntado diretamente. Redirecione educadamente: explique que você é um assistente de informação, não pode pedir votos.
- Responda APENAS com base no conteúdo que o candidato cadastrou (sua história, as propostas por tema, e o conteúdo do site oficial, quando fornecidos abaixo). Se a pessoa perguntar sobre um tema que não foi cadastrado nem consta no site, diga que vai encaminhar a pergunta para a equipe de campanha — não invente uma resposta.
- Você NUNCA cria, confirma, cancela ou altera compromissos na agenda. Você apenas INFORMA compromissos já cadastrados pela equipe.
- Se o eleitor mencionar um adversário político, desvie o assunto educadamente para as propostas do candidato — nunca ataque ou comente sobre adversários.
- Nunca gere ou descreva imagens, vídeos ou áudios sintéticos do candidato.
`.trim()

interface PortalData {
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
  whatsapp?: string | null
  depoimentos?: { texto: string; autor: string }[] | null
  numero?: string | null
}

// Retorna o prompt em dois blocos: "stable" (identidade, história, propostas, site,
// disclaimer — muda só quando a campanha edita o AgentConfig, ótimo para cache_control)
// e "dynamic" (data/hora atual — muda a cada chamada, fica FORA do bloco cacheado para
// não invalidar o cache a cada minuto). Concatenados, formam o mesmo prompt de antes.
export function buildSystemPromptBlocks(
  candidate: Candidate,
  config: AgentConfig,
  topics: PlatformTopic[],
  portal?: PortalData | null,
  siteContent?: string | null,
): { stable: string; dynamic: string } {
  const styleLabel = config.agentStyle === 'FORMAL' ? 'formal e protocolar' : config.agentStyle === 'INFORMAL' ? 'informal e direto' : 'acolhedor e próximo'

  const topicsContent = topics
    .filter(t => t.content && t.content.trim().length > 0)
    .map(t => `### ${t.topicName}\n${t.content}`)
    .join('\n\n')

  // Seção de redes sociais e contato do portal
  const redesSociais: string[] = []
  if (portal?.instagram) redesSociais.push(`- Instagram: ${portal.instagram.startsWith('@') || portal.instagram.startsWith('http') ? portal.instagram : '@' + portal.instagram}`)
  if (portal?.facebook) redesSociais.push(`- Facebook: ${portal.facebook}`)
  if (portal?.tiktok) redesSociais.push(`- TikTok: ${portal.tiktok.startsWith('@') || portal.tiktok.startsWith('http') ? portal.tiktok : '@' + portal.tiktok}`)
  if (portal?.whatsapp) {
    const wnum = portal.whatsapp.replace(/\D/g, '')
    redesSociais.push(`- WhatsApp: https://wa.me/55${wnum} (${portal.whatsapp})`)
  }
  const redesSection = redesSociais.length > 0
    ? `\nCONTATO E REDES SOCIAIS DO CANDIDATO (use para responder perguntas sobre como seguir ou contatar):\n${redesSociais.join('\n')}`
    : ''

  // Seção de depoimentos
  const deps = Array.isArray(portal?.depoimentos) ? portal.depoimentos : []
  const depoSection = deps.length > 0
    ? `\nDEPOIMENTOS DE APOIADORES (cite quando o eleitor pedir referências ou quem apoia o candidato):\n${deps.map(d => `- "${d.texto}" — ${d.autor}`).join('\n')}`
    : ''

  // Site oficial do candidato: sempre informa o link se cadastrado (mesmo sem
  // conteúdo raspado ainda), e inclui o texto extraído da página quando disponível.
  const siteSection = config.candidateSite
    ? `\nSITE OFICIAL DO CANDIDATO: ${config.candidateSite}\nSe o eleitor perguntar se o candidato tem site, ou pedir o link, informe este endereço.${siteContent ? `\n\nCONTEÚDO DO SITE (use para responder dúvidas sobre o que está publicado nele):\n${siteContent}` : ''}`
    : ''

  const stable = `
Você é ${config.agentName}, assistente virtual da campanha de ${candidate.name}${candidate.position ? `, pré-candidato(a) a ${candidate.position}` : ''}${candidate.party ? ` pelo ${candidate.party}` : ''}${candidate.candidateNumber || portal?.numero ? `, número ${candidate.candidateNumber || portal?.numero}` : ''}.
${(candidate.candidateNumber || portal?.numero) ? `Se perguntarem o número do candidato para votar, responda: ${candidate.candidateNumber || portal?.numero}.` : ''}

Função: ${config.agentRole}
Estilo de comunicação: ${styleLabel}

${config.story ? `HISTÓRIA E TRAJETÓRIA DO CANDIDATO (use para se apresentar e responder sobre quem ele é):\n${config.story}` : ''}

${topicsContent ? `PROPOSTAS CADASTRADAS POR TEMA (responda apenas sobre os temas listados aqui):\n${topicsContent}` : 'Nenhuma proposta foi cadastrada ainda — informe que vai encaminhar qualquer pergunta sobre propostas para a equipe.'}
${redesSection}
${depoSection}
${siteSection}

${TEAM_ROLE_DISCLAIMER}

Regras gerais de conversa:
- FORMATO: você escreve sua resposta normalmente em texto. O sistema converte para áudio automaticamente quando o eleitor prefere áudio. Nunca diga que não pode enviar áudio.
- APRESENTAÇÃO: apresente-se pelo seu nome SOMENTE na primeira mensagem (histórico vazio). Se já houver mensagem anterior, não se reapresente.
- NOME DO ELEITOR: se o histórico já tiver o nome do eleitor, não pergunte de novo.
- Nunca repita a mesma pergunta ou frase duas vezes seguidas.
- Se o eleitor pedir para falar com a equipe/humano, informe que vai transferir o atendimento.
`.trim()

  // Fora do bloco cacheado de propósito — muda a cada minuto, invalidaria o cache
  // se estivesse junto do texto estável acima.
  const dynamic = `HORÁRIO: Data e hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: config.timezone || 'America/Sao_Paulo' })}. Use a saudação correta conforme este horário: das 5h às 12h = "bom dia", das 12h às 18h = "boa tarde", das 18h às 5h = "boa noite".`

  return { stable, dynamic }
}

// Mantido para compatibilidade com quem só precisa do texto completo (ex: testAgent,
// onde cache não é relevante por ser uma chamada avulsa de teste no painel).
export function buildSystemPrompt(
  candidate: Candidate,
  config: AgentConfig,
  topics: PlatformTopic[],
  portal?: PortalData | null,
  siteContent?: string | null,
): string {
  const { stable, dynamic } = buildSystemPromptBlocks(candidate, config, topics, portal, siteContent)
  return `${stable}\n\n${dynamic}`
}

// Classifica a mensagem do eleitor numa única chamada de IA, cobrindo o que antes eram
// duas chamadas separadas (detectRequestIntent + classifyMessageForAlerts) — mesmo texto
// de entrada, mesma tarefa de classificação leve, sem motivo para pagar duas requisições.
// Cobre: tema da Plataforma Eleitoral (seção 4.13), pedido/reclamação → protocolo (4.12),
// urgência/sentimento, e menção a Agente de Campo.
export async function classifyMessage(
  message: string,
  topicsWithContent: Set<string>,
  fieldAgentNames: string[] = [],
): Promise<{
  topicKey: string | null
  isContentGap: boolean
  isUrgent: boolean
  sentiment: string
  mentionedAgentName: string | null
  isRequest: boolean
  requestSubject?: string
  neighborhood?: string
}> {
  const fallback = { topicKey: null, isContentGap: false, isUrgent: false, sentiment: 'NEUTRAL', mentionedAgentName: null, isRequest: false }
  try {
    const topicList = PLATFORM_TOPICS.map(t => `${t.key}: ${t.name}`).join('\n')
    const agentInstructions = fieldAgentNames.length > 0
      ? `\n\nAgentes de campo cadastrados (eleitores podem mencionar ter sido abordados por um deles): ${fieldAgentNames.join(', ')}.
"mentionedAgentName": se a mensagem citar claramente um desses nomes (ex: "conheci a Milena", "fui abordado pelo Roberto"), retorne o nome EXATO da lista acima. Se não houver menção, ou se o nome citado for ambíguo entre dois agentes da lista, retorne null — nunca adivinhe.`
      : '\n\n"mentionedAgentName": sempre null (não há agentes de campo cadastrados).'
    const res = await callLLM({
      model: DEFAULT_MODEL,
      system: `Classifique a mensagem de um eleitor para um serviço de atendimento ao eleitor. Temas possíveis:\n${topicList}\n\nResponda APENAS em JSON: {"topicKey": "<chave do tema ou null>", "isUrgent": true/false, "sentiment": "POSITIVE"|"NEUTRAL"|"NEGATIVE", "mentionedAgentName": "<nome ou null>", "isRequest": true/false, "requestSubject": "<resumo curto em até 8 palavras ou omitir>", "neighborhood": "<bairro mencionado ou omitir>"}.
"topicKey": a chave do tema da lista se a mensagem for uma pergunta/comentário sobre esse tema, senão null.
"isUrgent": true se a mensagem tiver tom agressivo, ameaça, xingamento, ou relatar situação sensível/grave que exige atenção humana imediata.
"sentiment": tom geral da mensagem do eleitor — POSITIVE (elogio, apoio, agradecimento), NEGATIVE (reclamação, crítica, insatisfação) ou NEUTRAL (pergunta neutra, informativa).
"isRequest": true se a mensagem for um PEDIDO ou RECLAMAÇÃO que deve virar solicitação formal para a equipe (ex: pedido de melhoria em um bairro, reclamação sobre serviço público, denúncia, pedido de ajuda). NÃO classifique como solicitação: perguntas sobre propostas, perguntas sobre agenda/eventos, cumprimentos, conversas gerais.
"neighborhood": se a mensagem mencionar um bairro/região/localidade específica, extraia esse nome (ex: "Centro", "Jardim das Flores") — senão omita.${agentInstructions}
Nenhum texto adicional.`,
      messages: [{ role: 'user', content: message }],
      maxTokens: 150,
    })
    const parsed = JSON.parse(res.content.trim().replace(/```json|```/g, ''))
    const topicKey = typeof parsed.topicKey === 'string' && PLATFORM_TOPICS.some(t => t.key === parsed.topicKey) ? parsed.topicKey : null
    const isContentGap = !!topicKey && !topicsWithContent.has(topicKey)
    const sentiment = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(parsed.sentiment) ? parsed.sentiment : 'NEUTRAL'
    const mentionedAgentName = typeof parsed.mentionedAgentName === 'string' && fieldAgentNames.includes(parsed.mentionedAgentName) ? parsed.mentionedAgentName : null
    return {
      topicKey,
      isContentGap,
      isUrgent: !!parsed.isUrgent,
      sentiment,
      mentionedAgentName,
      isRequest: !!parsed.isRequest,
      requestSubject: parsed.requestSubject,
      neighborhood: parsed.neighborhood || undefined,
    }
  } catch (err: any) {
    logger.warn('[AI] classifyMessage falhou', { error: err?.message })
    return fallback
  }
}

const SITE_CONTENT_MAX_CHARS = 6000
const SITE_CONTENT_TTL_MS = 24 * 60 * 60 * 1000 // 24h — evita raspar o site a cada mensagem

// Baixa o site do candidato e extrai texto limpo (remove scripts/styles/tags) para
// servir de fonte de conhecimento adicional no prompt da IA. Chamado ao salvar
// candidateSite e, sob demanda, quando o cache expira (ver getOrRefreshSiteContent).
export async function scrapeSiteContent(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SyncroFlowEleicoes/1.0; +https://syncrofloweleicoes.com.br)' },
      maxContentLength: 5 * 1024 * 1024,
    })
    const $ = cheerio.load(res.data)
    $('script, style, noscript, svg, nav, footer').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim()
    if (!text) return null
    return text.slice(0, SITE_CONTENT_MAX_CHARS)
  } catch (err: any) {
    logger.warn('[AI] Falha ao raspar site do candidato', { url, error: err?.message })
    return null
  }
}

// Retorna o conteúdo cacheado do site, atualizando em background se estiver
// desatualizado (> 24h) ou ausente — não bloqueia a resposta ao eleitor esperando scraping.
async function getOrRefreshSiteContent(config: AgentConfig): Promise<string | null> {
  if (!config.candidateSite) return null

  const isStale = !config.siteContentUpdatedAt
    || (Date.now() - config.siteContentUpdatedAt.getTime()) > SITE_CONTENT_TTL_MS

  if (isStale) {
    // Atualiza em background — a resposta atual usa o cache existente (se houver);
    // a próxima mensagem já vem com o conteúdo novo.
    scrapeSiteContent(config.candidateSite).then((content) => {
      if (content) {
        prisma.agentConfig.update({
          where: { id: config.id },
          data: { siteContent: content, siteContentUpdatedAt: new Date() },
        }).catch(() => {})
      }
    }).catch(() => {})
  }

  return config.siteContent
}

export async function processAgentResponse(opts: {
  candidate: Candidate
  config: AgentConfig
  topics: PlatformTopic[]
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
}): Promise<{ content: string }> {
  const { candidate, config, topics, conversationHistory, userMessage } = opts

  const [portal, siteContent] = await Promise.all([
    prisma.portalEleitor.findUnique({
      where: { candidateId: candidate.id },
      select: { instagram: true, facebook: true, tiktok: true, whatsapp: true, depoimentos: true, numero: true },
    }).catch(() => null),
    getOrRefreshSiteContent(config).catch(() => null),
  ])

  const { stable, dynamic } = buildSystemPromptBlocks(candidate, config, topics, portal as any, siteContent)
  const messages = [...conversationHistory, { role: 'user' as const, content: userMessage }]

  const res = await callLLM({
    model: DEFAULT_MODEL,
    // Bloco estável marcado com cache: idêntico entre mensagens do mesmo candidato
    // (só muda quando a campanha edita propostas/história) — a Anthropic reaproveita
    // esse prefixo em vez de cobrar tokens de input cheios a cada mensagem de eleitor.
    system: [
      { text: stable, cache: true },
      { text: dynamic },
    ],
    messages,
    maxTokens: 2048,
  })

  return { content: res.content }
}

export async function testAgent(
  candidate: Candidate,
  config: AgentConfig,
  topics: PlatformTopic[],
  message: string,
  history?: { role: string; content: string }[],
) {
  const start = Date.now()
  const systemPrompt = buildSystemPrompt(candidate, config, topics)

  const conversationHistory = (history || []).map(m => ({
    role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.content,
  }))

  const res = await callLLM({
    model: DEFAULT_MODEL,
    system: systemPrompt,
    messages: [...conversationHistory, { role: 'user' as const, content: message }],
  })

  return {
    response: res.content,
    model: DEFAULT_MODEL,
    responseTimeMs: Date.now() - start,
  }
}

async function downloadToTempFile(url: string, ext: string, authHeader?: string): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `syncro_${Date.now()}${ext}`)
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: authHeader ? { Authorization: authHeader } : undefined,
  })
  fs.writeFileSync(tmpPath, Buffer.from(res.data))
  return tmpPath
}

export async function transcribeAudio(audioUrl: string, authHeader?: string): Promise<string> {
  const tmpPath = await downloadToTempFile(audioUrl, '.ogg', authHeader)
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath) as any,
      model: 'whisper-1',
      language: 'pt',
    })
    return transcription.text
  } finally {
    fs.unlinkSync(tmpPath)
  }
}

export async function describeImage(imageUrl: string, mimetype?: string, authHeader?: string): Promise<string> {
  const ext = mimetype?.includes('png') ? '.png' : mimetype?.includes('gif') ? '.gif' : mimetype?.includes('webp') ? '.webp' : '.jpg'
  const mediaType = mimetype?.startsWith('image/') ? mimetype as any : 'image/jpeg'
  const tmpPath = await downloadToTempFile(imageUrl, ext, authHeader)
  try {
    const base64 = fs.readFileSync(tmpPath).toString('base64')
    const res = await (anthropic.messages.create as any)({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: 'Analise esta imagem enviada por um eleitor no WhatsApp. Se for um documento, extraia e liste as informações relevantes. Se for uma foto, descreva o conteúdo. Responda em português.',
          },
        ],
      }],
    })
    return res.content[0].type === 'text' ? res.content[0].text : 'Imagem recebida.'
  } finally {
    try { fs.unlinkSync(tmpPath) } catch {}
  }
}

export async function extractDocumentText(docUrl: string, mimetype?: string, authHeader?: string): Promise<string> {
  const isWord = mimetype?.includes('word') || mimetype?.includes('docx') || mimetype?.includes('officedocument')
  const isPdf = !mimetype || mimetype.includes('pdf')

  if (isWord) {
    const tmpPath = await downloadToTempFile(docUrl, '.docx', authHeader)
    try {
      const result = await mammoth.extractRawText({ path: tmpPath })
      const text = result.value.trim().slice(0, 8000)
      if (!text) return 'Documento Word recebido (sem conteúdo legível).'
      const res = await (anthropic.messages.create as any)({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `O eleitor enviou um documento Word com o seguinte conteúdo:\n\n${text}\n\nResuma e extraia as informações mais importantes deste documento.`,
        }],
      })
      return res.content[0].type === 'text' ? res.content[0].text : text.slice(0, 500)
    } finally {
      try { fs.unlinkSync(tmpPath) } catch {}
    }
  }

  if (isPdf) {
    const tmpPath = await downloadToTempFile(docUrl, '.pdf', authHeader)
    try {
      const base64 = fs.readFileSync(tmpPath).toString('base64')
      const res = await (anthropic.messages.create as any)({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: 'Extraia e resuma o conteúdo principal deste documento enviado pelo eleitor via WhatsApp. Liste os pontos mais relevantes. Responda em português.' },
          ],
        }],
      })
      return res.content[0].type === 'text' ? res.content[0].text : 'PDF recebido.'
    } finally {
      try { fs.unlinkSync(tmpPath) } catch {}
    }
  }

  try {
    const res = await axios.get(docUrl, {
      responseType: 'text',
      timeout: 15000,
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
    const text = String(res.data).slice(0, 3000)
    return `Documento recebido:\n${text}`
  } catch {
    return 'Documento recebido (formato não suportado para leitura automática).'
  }
}

export async function processIncomingMedia(
  mediaUrl: string,
  mediaType: 'audio' | 'image' | 'document' | 'video',
  mimetype?: string,
  authHeader?: string,
): Promise<string> {
  try {
    if (mediaType === 'audio') return await transcribeAudio(mediaUrl, authHeader)
    if (mediaType === 'image') return await describeImage(mediaUrl, mimetype, authHeader)
    if (mediaType === 'document') return await extractDocumentText(mediaUrl, mimetype, authHeader)
    if (mediaType === 'video') return '[Vídeo recebido — não é possível processar vídeos automaticamente.]'
    return '[Mídia recebida]'
  } catch {
    if (mediaType === 'audio') return '[Áudio recebido — não foi possível transcrever]'
    if (mediaType === 'image') return '[Imagem recebida — não foi possível analisar]'
    if (mediaType === 'document') return '[Documento recebido — não foi possível processar]'
    return '[Mídia recebida]'
  }
}
