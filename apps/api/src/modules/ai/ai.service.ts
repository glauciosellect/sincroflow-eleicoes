import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { AgentConfig, Candidate, PlatformTopic } from '@prisma/client'
import axios from 'axios'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import mammoth from 'mammoth'
import { PLATFORM_TOPICS } from '../../lib/platform-topics'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const DEFAULT_MODEL = 'claude-haiku-4-5'

export async function callLLM(opts: {
  model: string
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const { model, system, messages, maxTokens = 1024 } = opts

  if (model.startsWith('claude')) {
    const res = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    })
    const content = res.content[0].type === 'text' ? res.content[0].text : ''
    return { content, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
  }

  if (model.startsWith('gpt')) {
    const res = await openai.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
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
- Responda APENAS com base no conteúdo que o candidato cadastrou (sua história e as propostas por tema abaixo). Se a pessoa perguntar sobre um tema que não foi cadastrado, diga que vai encaminhar a pergunta para a equipe de campanha — não invente uma resposta.
- Você NUNCA cria, confirma, cancela ou altera compromissos na agenda. Você apenas INFORMA compromissos já cadastrados pela equipe.
- Se o eleitor mencionar um adversário político, desvie o assunto educadamente para as propostas do candidato — nunca ataque ou comente sobre adversários.
- Nunca gere ou descreva imagens, vídeos ou áudios sintéticos do candidato.
`.trim()

export function buildSystemPrompt(
  candidate: Candidate,
  config: AgentConfig,
  topics: PlatformTopic[],
): string {
  const styleLabel = config.agentStyle === 'FORMAL' ? 'formal e protocolar' : config.agentStyle === 'INFORMAL' ? 'informal e direto' : 'acolhedor e próximo'

  const topicsContent = topics
    .filter(t => t.content && t.content.trim().length > 0)
    .map(t => `### ${t.topicName}\n${t.content}`)
    .join('\n\n')

  return `
Você é ${config.agentName}, assistente virtual da campanha de ${candidate.name}${candidate.position ? `, pré-candidato(a) a ${candidate.position}` : ''}${candidate.party ? ` pelo ${candidate.party}` : ''}${candidate.candidateNumber ? `, número ${candidate.candidateNumber}` : ''}.
${candidate.candidateNumber ? `Se perguntarem o número do candidato para votar, responda: ${candidate.candidateNumber}.` : ''}

Função: ${config.agentRole}
Estilo de comunicação: ${styleLabel}

${config.story ? `HISTÓRIA E TRAJETÓRIA DO CANDIDATO (use para se apresentar e responder sobre quem ele é):\n${config.story}` : ''}

${topicsContent ? `PROPOSTAS CADASTRADAS POR TEMA (responda apenas sobre os temas listados aqui):\n${topicsContent}` : 'Nenhuma proposta foi cadastrada ainda — informe que vai encaminhar qualquer pergunta sobre propostas para a equipe.'}

${TEAM_ROLE_DISCLAIMER}

Regras gerais de conversa:
- HORÁRIO: Data e hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: config.timezone || 'America/Sao_Paulo' })}. Use a saudação correta conforme este horário: das 5h às 12h = "bom dia", das 12h às 18h = "boa tarde", das 18h às 5h = "boa noite".
- FORMATO: você escreve sua resposta normalmente em texto. O sistema converte para áudio automaticamente quando o eleitor prefere áudio. Nunca diga que não pode enviar áudio.
- APRESENTAÇÃO: apresente-se pelo seu nome SOMENTE na primeira mensagem (histórico vazio). Se já houver mensagem anterior, não se reapresente.
- NOME DO ELEITOR: se o histórico já tiver o nome do eleitor, não pergunte de novo.
- Nunca repita a mesma pergunta ou frase duas vezes seguidas.
- Se o eleitor pedir para falar com a equipe/humano, informe que vai transferir o atendimento.
`.trim()
}

// Detecta se a mensagem é um pedido/reclamação que deve gerar protocolo de solicitação
// (seção 4.12 da spec) — ex: "queria pedir para arrumar a iluminação da minha rua".
// Não classifica perguntas simples sobre propostas como solicitação.
export async function detectRequestIntent(message: string): Promise<{ isRequest: boolean; subject?: string; neighborhood?: string }> {
  try {
    const res = await callLLM({
      model: DEFAULT_MODEL,
      system: `Você classifica mensagens de eleitores para uma campanha eleitoral. Determine se a mensagem é um PEDIDO ou RECLAMAÇÃO que deve ser registrado como solicitação formal para a equipe (ex: pedido de melhoria em um bairro, reclamação sobre um serviço público, denúncia, pedido de ajuda).
NÃO classifique como solicitação: perguntas sobre propostas do candidato, perguntas sobre agenda/eventos, cumprimentos, conversas gerais.
Se a mensagem mencionar um bairro, região ou localidade específica, extraia esse nome em "neighborhood" (ex: "Centro", "Jardim das Flores") — senão omita o campo.
Responda APENAS em JSON: {"isRequest": true/false, "subject": "resumo curto do pedido em até 8 palavras", "neighborhood": "<bairro mencionado ou omitir>"} (subject pode ser omitido se isRequest for false). Nenhum texto adicional.`,
      messages: [{ role: 'user', content: message }],
      maxTokens: 100,
    })
    const parsed = JSON.parse(res.content.trim().replace(/```json|```/g, ''))
    return { isRequest: !!parsed.isRequest, subject: parsed.subject, neighborhood: parsed.neighborhood || undefined }
  } catch {
    return { isRequest: false }
  }
}

// Classifica a mensagem do eleitor para os alertas automáticos (seção 4.13 da spec):
// tema da Plataforma Eleitoral envolvido (para pico por tema), se é uma pergunta sobre
// tema sem conteúdo cadastrado (gap), e se o tom é agressivo/sensível (urgência).
export async function classifyMessageForAlerts(
  message: string,
  topicsWithContent: Set<string>,
  fieldAgentNames: string[] = [],
): Promise<{ topicKey: string | null; isContentGap: boolean; isUrgent: boolean; sentiment: string; mentionedAgentName: string | null }> {
  try {
    const topicList = PLATFORM_TOPICS.map(t => `${t.key}: ${t.name}`).join('\n')
    const agentInstructions = fieldAgentNames.length > 0
      ? `\n\nAgentes de campo cadastrados (eleitores podem mencionar ter sido abordados por um deles): ${fieldAgentNames.join(', ')}.
"mentionedAgentName": se a mensagem citar claramente um desses nomes (ex: "conheci a Milena", "fui abordado pelo Roberto"), retorne o nome EXATO da lista acima. Se não houver menção, ou se o nome citado for ambíguo entre dois agentes da lista, retorne null — nunca adivinhe.`
      : '\n\n"mentionedAgentName": sempre null (não há agentes de campo cadastrados).'
    const res = await callLLM({
      model: DEFAULT_MODEL,
      system: `Classifique a mensagem de um eleitor para uma campanha eleitoral. Temas possíveis:\n${topicList}\n\nResponda APENAS em JSON: {"topicKey": "<chave do tema ou null>", "isUrgent": true/false, "sentiment": "POSITIVE"|"NEUTRAL"|"NEGATIVE", "mentionedAgentName": "<nome ou null>"}.
"topicKey": a chave do tema da lista se a mensagem for uma pergunta/comentário sobre esse tema, senão null.
"isUrgent": true se a mensagem tiver tom agressivo, ameaça, xingamento, ou relatar situação sensível/grave que exige atenção humana imediata.
"sentiment": tom geral da mensagem do eleitor — POSITIVE (elogio, apoio, agradecimento), NEGATIVE (reclamação, crítica, insatisfação) ou NEUTRAL (pergunta neutra, informativa).${agentInstructions}
Nenhum texto adicional.`,
      messages: [{ role: 'user', content: message }],
      maxTokens: 100,
    })
    const parsed = JSON.parse(res.content.trim().replace(/```json|```/g, ''))
    const topicKey = typeof parsed.topicKey === 'string' && PLATFORM_TOPICS.some(t => t.key === parsed.topicKey) ? parsed.topicKey : null
    const isContentGap = !!topicKey && !topicsWithContent.has(topicKey)
    const sentiment = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(parsed.sentiment) ? parsed.sentiment : 'NEUTRAL'
    const mentionedAgentName = typeof parsed.mentionedAgentName === 'string' && fieldAgentNames.includes(parsed.mentionedAgentName) ? parsed.mentionedAgentName : null
    return { topicKey, isContentGap, isUrgent: !!parsed.isUrgent, sentiment, mentionedAgentName }
  } catch {
    return { topicKey: null, isContentGap: false, isUrgent: false, sentiment: 'NEUTRAL', mentionedAgentName: null }
  }
}

export async function processAgentResponse(opts: {
  candidate: Candidate
  config: AgentConfig
  topics: PlatformTopic[]
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
}): Promise<{ content: string }> {
  const { candidate, config, topics, conversationHistory, userMessage } = opts

  const systemPrompt = buildSystemPrompt(candidate, config, topics)
  const messages = [...conversationHistory, { role: 'user' as const, content: userMessage }]

  const res = await callLLM({
    model: DEFAULT_MODEL,
    system: systemPrompt,
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
